import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import { buildState, emptyHistory, stampHistory, VOIV } from "./fusion.mjs";
import { ingestLive, emptyInput, INGEST_EVERY_MS } from "./ingest.mjs";
import { notifyFromState, pushPublicKey, upsertPushSub, removePushSub } from "./push.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8787);
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  next();
});

let state = buildState(Date.now(), emptyInput(), null);
let historyBundle = emptyHistory(12);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "zorya", live: !state.demo, generated_at: state.generated_at });
});

app.get("/api/state", (_req, res) => {
  res.json(state);
});

app.get("/api/history/bundle", (req, res) => {
  const hours = Math.min(12, Math.max(1, Number(req.query.hours || 12)));
  res.json({ ...historyBundle, hours });
});

app.get("/api/meta", (_req, res) => {
  res.json({ voivodeships: VOIV, demo: false, attribution: "https://neptun.in.ua/", pushKey: pushPublicKey() });
});

app.get("/api/push/key", (_req, res) => {
  res.json({ publicKey: pushPublicKey() });
});

app.post("/api/push/subscribe", (req, res) => {
  try {
    res.json(upsertPushSub(req.body || {}));
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "subscribe" });
  }
});

app.post("/api/push/unsubscribe", (req, res) => {
  removePushSub(req.body?.endpoint);
  res.json({ ok: true });
});

if (isProd) {
  const dist = path.join(root, "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/api/ws" });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const c of wss.clients) {
    if (c.readyState === 1) c.send(data);
  }
}

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "state", state }));
});

let cycling = false;
async function cycle() {
  if (cycling) return;
  cycling = true;
  try {
    const live = await ingestLive();
    state = buildState(Date.now(), live.input, live.sources);
    stampHistory(historyBundle, state);
    broadcast({ type: "state", state });
    void notifyFromState(state);
  } catch (err) {
    console.error("Zorya ingest", err.message || err);
  } finally {
    cycling = false;
  }
}

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Zorya fusion live http://127.0.0.1:${PORT}`);
  void cycle();
  setInterval(() => void cycle(), INGEST_EVERY_MS);
});
