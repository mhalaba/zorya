/** Read a public Telegram channel through its web preview (https://t.me/s/<name>). No login, no API key. */
const UA = "Mozilla/5.0 (compatible; ZoryaTracker/1.0; +https://zorya.website)";
const TIMEOUT_MS = 15_000;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decodeHtml(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
      if (e[0] === "#") {
        const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
      }
      return ENT[e.toLowerCase()] ?? m;
    });
}

/** Parse the preview HTML → [{ id, ts, text }] (oldest first). */
export function parsePreview(html, channel) {
  const out = [];
  const parts = String(html).split('class="tgme_widget_message_wrap').slice(1);
  for (const p of parts) {
    const post = p.match(/data-post="([^"/]+)\/(\d+)"/);
    if (!post) continue;
    if (channel && post[1].toLowerCase() !== channel.toLowerCase()) continue;
    const dt = p.match(/<time[^>]*datetime="([^"]+)"/);
    const body = p.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const text = body ? decodeHtml(body[1]).trim() : "";
    out.push({ id: Number(post[2]), ts: dt ? Date.parse(dt[1]) : NaN, text });
  }
  return out.filter((m) => Number.isFinite(m.id)).sort((a, b) => a.id - b.id);
}

export async function fetchChannel(name) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`https://t.me/s/${encodeURIComponent(name)}`, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "uk,en;q=0.5" },
      redirect: "manual",
      signal: ctl.signal,
    });
    if (r.status === 429) throw Object.assign(new Error("HTTP 429"), { retry: true });
    if (r.status >= 300 && r.status < 400) throw new Error(`HTTP ${r.status} (podgląd kanału niedostępny)`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parsePreview(await r.text(), name);
  } finally {
    clearTimeout(t);
  }
}
