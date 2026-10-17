import test from "node:test";
import assert from "node:assert/strict";
import { parsePost } from "./uatracker/parse.mjs";
import { Engine } from "./uatracker/engine.mjs";
import { parsePreview } from "./uatracker/telegram.mjs";

test("kpszsu style: position + heading", () => {
  const r = parsePost("🛵 Ударний БпЛА  повз Деражню у напрямку Хмельницького");
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].kind, "drone_piston");
  assert.equal(r.events[0].pos.name, "Деражня");
  assert.equal(r.events[0].target.name, "Хмельницький");
});

test("aggregator list with oblast headers and counts", () => {
  const r = parsePost("Чернігівщина:\nРеактивний БпЛА курсом на Сновськ\n2х БпЛА курсом на Ріпки\n\nХмельниччина:\nБпЛА курсом на Віньківці");
  assert.deepEqual(r.events.map((e) => [e.kind, e.count, e.target.name, e.target.oblast]), [
    ["drone_jet", 1, "Сновськ", "02"],
    ["drone_piston", 2, "Ріпки", "02"],
    ["drone_piston", 1, "Віньківці", "09"],
  ]);
});

test("missile, origin zone, all-clear, kill", () => {
  // S8000 "Бандероль" is a jet loitering munition (MAPA.UA: drone_jet / banderol), not a cruise missile.
  assert.equal(parsePost("Бандероль🚀→Дніпро/р-н").events[0].kind, "drone_jet");
  assert.equal(parsePost("Реактивний від Брянщини на Корюківку", { oblast: "02" }).events[0].from.zone, "bryansk");
  assert.equal(parsePost("відбій по області 📡", { oblast: "01" }).clears[0].oblast, "01");
  assert.equal(parsePost("Знищено").kills.length, 1);
  assert.equal(parsePost("У мікрорайоні Корабел — активність дрона типу «Mavic»").events.length, 0);
});

test("engine merges the same drone reported by two channels", () => {
  const e = new Engine();
  const t = Date.now();
  const ev = parsePost("БпЛА курсом на Ріпки", { oblast: "02" }).events[0];
  const a = e.ingest(ev, { channel: "a", msgId: 1, url: "u1", ts: t, weight: 0.6 });
  const b = e.ingest(ev, { channel: "b", msgId: 7, url: "u2", ts: t + 60_000, weight: 0.8 });
  assert.equal(a, b);
  const s = e.snapshot(t + 61_000);
  assert.equal(s.length, 1);
  assert.equal(s[0].confidence, 0.92);
  assert.equal(s[0].source, "own");
});

test("preview HTML parser", () => {
  const html = '<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="kpszsu/5"><div class="tgme_widget_message_text js-message_text" dir="auto">БпЛА на Остер<br/>2&#33;</div><time datetime="2026-10-17T15:00:00+00:00" class="time">18:00</time></div></div>';
  const m = parsePreview(html, "kpszsu");
  assert.equal(m.length, 1);
  assert.equal(m[0].id, 5);
  assert.equal(m[0].text, "БпЛА на Остер\n2!");
});

test("town lists, locative region hint, region-only heading", () => {
  const list = parsePost("Одещина:\n• 8х шахедів курсом на Південне, Татарбунари;").events;
  assert.deepEqual(list.map((e) => e.target.name).sort(), ["Південне", "Татарбунари"]);
  assert.equal(list.reduce((a, e) => a + e.count, 0), 8);
  const sm = parsePost("⚠️2 реактивні шахеди на Черкащині повз Смілу на Київщину", { national: true }).events[0];
  assert.equal(sm.pos.name, "Сміла");
  assert.equal(sm.count, 2);
  assert.ok(sm.heading > 280 && sm.heading < 360);
  assert.equal(parsePost("⚠️1 шахед з Вінниччини на Хмельниччину на Віньківці").events[0].target.name, "Віньківці");
  const kp = parsePost("🏍 Реактивні БпЛА на Чернігівщині в р-ні. Добрянки курс південно-західний.", { national: true }).events[0];
  assert.equal(kp.pos.name, "Добрянка");
  assert.equal(kp.heading, 225);
});
