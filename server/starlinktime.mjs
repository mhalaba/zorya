// Time from the Starlink dish's own NTP server (GPS-disciplined, stratum 1) at 192.168.100.1.
// Never falls back to the local clock: if the dish does not answer, the endpoint says so.
import dgram from "node:dgram";

const HOST = process.env.STARLINK_NTP_HOST || "192.168.100.1";
const NTP_EPOCH_OFFSET = 2208988800; // seconds between 1900-01-01 and 1970-01-01
const MIN_QUERY_MS = 15_000; // at most one NTP query per 15 s, however many browsers ask
const STALE_MS = 120_000; // after 2 min without a valid answer we report "no sync"

let last = null; // { ntpMs, mono, stratum, rttMs }
let lastError = null;
let lastTry = 0;
let inflight = null;

const monoMs = () => Number(process.hrtime.bigint() / 1_000_000n);

function queryNtp(host, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    const pkt = Buffer.alloc(48);
    pkt[0] = 0x23; // LI 0, VN 4, mode 3 (client)
    const t0 = monoMs();
    const timer = setTimeout(() => { sock.close(); reject(new Error("timeout")); }, timeoutMs);
    sock.once("error", (e) => { clearTimeout(timer); sock.close(); reject(e); });
    sock.once("message", (m) => {
      const t1 = monoMs();
      clearTimeout(timer);
      sock.close();
      if (m.length < 48) return reject(new Error("short reply"));
      const mode = m[0] & 0x7;
      const leap = m[0] >> 6;
      const stratum = m[1];
      if (mode !== 4 || leap === 3 || stratum < 1 || stratum > 15) return reject(new Error(`unsynchronised (stratum ${stratum})`));
      const sec = m.readUInt32BE(40) - NTP_EPOCH_OFFSET;
      const frac = m.readUInt32BE(44) / 2 ** 32;
      const rttMs = t1 - t0;
      // Dish transmit time + half the round trip = Starlink time at the moment we received the reply.
      resolve({ ntpMs: (sec + frac) * 1000 + rttMs / 2, mono: t1, stratum, rttMs });
    });
    sock.send(pkt, 123, host, (e) => { if (e) { clearTimeout(timer); sock.close(); reject(e); } });
  });
}

async function refresh() {
  if (inflight) return inflight;
  if (monoMs() - lastTry < MIN_QUERY_MS) return;
  lastTry = monoMs();
  inflight = queryNtp(HOST)
    .then((r) => { last = r; lastError = null; })
    .catch((e) => { lastError = String(e?.message || e); })
    .finally(() => { inflight = null; });
  return inflight;
}

export async function starlinkTime() {
  await refresh();
  const now = monoMs();
  const base = {
    source: "Starlink NTP (GPS)",
    host: HOST,
    note: "Czas z serwera NTP anteny Starlink (GPS), nie z zegara serwera ani przeglądarki.",
  };
  if (!last || now - last.mono > STALE_MS) {
    return { ok: false, ...base, error: lastError || "brak odpowiedzi", synced_at: last ? new Date(last.ntpMs).toISOString() : null };
  }
  // Advance the last Starlink reading with a monotonic clock (the server's wall clock is not used).
  const starlinkMs = last.ntpMs + (now - last.mono);
  return {
    ok: true,
    ...base,
    starlink_ms: Math.round(starlinkMs),
    starlink_utc: new Date(starlinkMs).toISOString(),
    synced_at: new Date(last.ntpMs).toISOString(),
    stratum: last.stratum,
    rtt_ms: last.rttMs,
  };
}
