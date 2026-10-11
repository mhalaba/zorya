// Run: node --test server/security.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { rateLimit, safeEqual, safeHttpUrl } from "./security.mjs";
import { cleanReport } from "./horizon.mjs";
import { parseFeed } from "./util.mjs";
import { toCsv } from "./archive.mjs";

function call(mw, ip) {
  let status = 200;
  let passed = false;
  const res = {
    setHeader() {},
    status(s) {
      status = s;
      return this;
    },
    json() {},
  };
  mw({ headers: {}, socket: { remoteAddress: ip } }, res, () => {
    passed = true;
  });
  return passed ? 200 : status;
}

test("rateLimit: per-IP window", () => {
  const mw = rateLimit({ windowMs: 60_000, max: 2 });
  assert.equal(call(mw, "1.1.1.1"), 200);
  assert.equal(call(mw, "1.1.1.1"), 200);
  assert.equal(call(mw, "1.1.1.1"), 429);
  assert.equal(call(mw, "2.2.2.2"), 200);
});

test("safeHttpUrl and safeEqual", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,x"), null);
  assert.equal(safeHttpUrl("https://www.pap.pl/a?b=1"), "https://www.pap.pl/a?b=1");
  assert.equal(safeHttpUrl(" not a url"), null);
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
});

test("cleanReport: whitelist, 500 m grid, bounds, note length", () => {
  const r = cleanReport({
    kind: "dron_samolot",
    observed_at: new Date().toISOString(),
    location: { lat: 51.246789, lon: 22.568123, rounded_m: 1 },
    note: "x".repeat(900),
    __proto__: { admin: true },
    extra: "dropped",
  });
  assert.equal(r.kind, "dron_samolot");
  assert.equal(r.note.length, 500);
  assert.equal(r.location.rounded_m, 500);
  assert.ok(Math.abs(r.location.lat - 51.246789) < 0.005 && r.location.lat !== 51.246789);
  assert.ok(!("extra" in r));
  assert.throws(() => cleanReport({ kind: "rm -rf", location: { lat: 51, lon: 22 } }));
  assert.throws(() => cleanReport({ kind: "huk", location: { lat: 40, lon: 22 } }));
  assert.throws(() => cleanReport({ kind: "huk", location: {} }));
});

test("parseFeed: RSS and Atom, HTML pages rejected", () => {
  const rss = parseFeed("<rss><channel><item><title>A &amp; B</title><link>https://x.pl/1</link><pubDate>Sun, 11 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>", "t");
  assert.equal(rss[0].title, "A & B");
  assert.equal(rss[0].ts, Date.UTC(2026, 9, 11, 8));
  const atom = parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Wyłączenie</title><link href="https://op.pl/w?a=1&amp;b=2"/><updated>2026-10-11T08:00:00Z</updated><summary>15.10.2026</summary></entry></feed>', "f");
  assert.equal(atom[0].url, "https://op.pl/w?a=1&b=2");
  assert.equal(atom[0].desc, "15.10.2026");
  assert.throws(() => parseFeed("<html><body>Not found</body></html>", "x"));
});

test("toCsv neutralises spreadsheet formulas in text, keeps numbers", () => {
  const csv = toCsv([{ a: "=HYPERLINK(1)", b: -5, c: "@x", d: "ok" }]);
  assert.equal(csv, "a,b,c,d\n'=HYPERLINK(1),-5,'@x,ok\n");
});
