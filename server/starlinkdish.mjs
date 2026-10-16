// Latest Starlink dish sample (state, GPS satellites) as logged ~every 1-2 s by starlink_analiza,
// which reads the dish's own gRPC get_status at 192.168.100.1:9200. Read via its dashboard API on the host.
import fs from "node:fs";

const MAX_AGE_S = 30; // older sample = "no data from the dish"
const CACHE_MS = 5_000;
let cache = null;
let cacheAt = 0;

function hostGateway() {
  try {
    for (const line of fs.readFileSync("/proc/net/route", "utf8").split("\n").slice(1)) {
      const f = line.trim().split(/\s+/);
      if (f[1] === "00000000" && f[2] && f[2] !== "00000000") {
        const n = parseInt(f[2], 16);
        return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255].join(".");
      }
    }
  } catch { /* not Linux */ }
  return "127.0.0.1";
}

const URL_ = process.env.STARLINK_DASH_URL || `http://${hostGateway()}:8094/api/summary`;

export async function starlinkDish() {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const base = { source: "antena Starlink (gRPC get_status, 192.168.100.1:9200) przez starlink_analiza" };
  let out;
  try {
    const r = await fetch(URL_, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const l = d?.latest || {};
    const age = typeof d?.age_s === "number" ? d.age_s : null;
    if (age === null || age > MAX_AGE_S || typeof l.gps_sats !== "number") {
      out = { ok: false, ...base, error: age === null ? "brak próbki" : `próbka sprzed ${Math.round(age)} s` };
    } else {
      out = {
        ok: true,
        ...base,
        state: typeof l.state === "string" ? l.state : null,
        gps_valid: l.gps_valid === 1 || l.gps_valid === true,
        gps_sats: l.gps_sats,
        sample_utc: typeof l.ts_utc === "number" ? new Date(l.ts_utc).toISOString() : null,
        age_s: Math.round(age * 10) / 10,
      };
    }
  } catch (e) {
    out = { ok: false, ...base, error: String(e?.message || e) };
  }
  cache = out;
  cacheAt = Date.now();
  return out;
}
