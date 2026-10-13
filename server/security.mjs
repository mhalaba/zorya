/** HTTP hardening shared by the API: security headers, per-IP rate limits, safe outbound URLs. */

import crypto from "node:crypto";

/** Client address: Cloudflare's header when the request came through the tunnel, else the socket. */
export function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.length <= 64) return cf.trim();
  return String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}

/**
 * Fixed-window counter per IP. `max` requests per `windowMs`; over the limit → 429 with Retry-After.
 * Memory is bounded: the table is swept every window and capped at `maxKeys` entries.
 */
export function rateLimit({ windowMs, max, maxKeys = 50_000, name = "api" }) {
  const hits = new Map();
  let windowStart = Date.now();
  return (req, res, next) => {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      hits.clear();
      windowStart = now;
    }
    const ip = clientIp(req) || "?";
    const n = (hits.get(ip) || 0) + 1;
    if (n === 1 && hits.size >= maxKeys) {
      // Table full (likely a spray of addresses): refuse new keys until the window turns over.
      res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - windowStart)) / 1000)));
      return res.status(429).json({ error: `za dużo zapytań (${name})` });
    }
    hits.set(ip, n);
    if (n > max) {
      res.setHeader("Retry-After", String(Math.ceil((windowMs - (now - windowStart)) / 1000)));
      return res.status(429).json({ error: `za dużo zapytań (${name})` });
    }
    next();
  };
}

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Headers for every response. CSP only in production (Vite dev injects inline scripts). */
export function securityHeaders({ isProd }) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)");
    if (isProd) res.setHeader("Content-Security-Policy", CSP);
    if (req.path.startsWith("/api")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      // Public read-only data may be embedded elsewhere; writes stay same-origin (no CORS headers).
      if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      }
    }
    next();
  };
}

/** Only absolute http(s) links reach the browser; anything else (javascript:, data:, junk) becomes null. */
export function safeHttpUrl(u) {
  if (typeof u !== "string" || !u || u.length > 2048) return null;
  try {
    const url = new URL(u.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
