// Run: node --test server/local.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { classifyLocal, createLocalStore, itemState, parsePlWindow, toLocalItems } from "./local.mjs";
import { mapRso } from "./ingest.mjs";
import { warsawToUtc } from "./util.mjs";

const REF = warsawToUtc(2026, 10, 11, 9, 0); // 11.10.2026 09:00 Warsaw

test("classifyLocal: power, water, gas, exercise and what is not ours", () => {
  assert.deepEqual(classifyLocal("Planowana przerwa w dostawie energii elektrycznej", "PGE Dystrybucja informuje o pracach modernizacyjnych sieci."), {
    categories: ["power"],
    kind: "planned",
  });
  assert.equal(classifyLocal("Awaria sieci energetycznej — odbiorcy bez prądu", "").kind, "outage");
  assert.deepEqual(classifyLocal("Komunikat w sprawie przydatności wody do spożycia", "Woda nieprzydatna do spożycia, bakterie grupy coli.").categories, ["water"]);
  assert.equal(classifyLocal("Przerwa w dostawie wody", "W związku z pracami remontowymi sieci wodociągowej").kind, "planned");
  assert.deepEqual(classifyLocal("Wstrzymanie dostaw gazu", "Polska Spółka Gazownictwa").categories, ["gas"]);
  assert.equal(classifyLocal("Ulatnianie się gazu w Lublinie", "").kind, "outage");
  assert.deepEqual(classifyLocal("Ćwiczenia wojskowe na poligonie", "Możliwe utrudnienia, w tym czasowe wyłączenia prądu."), {
    categories: ["exercise", "power"],
    kind: "exercise",
  });
  assert.equal(classifyLocal("Test syren alarmowych w powiecie", "").kind, "exercise");
  // Weather/flood warnings, smog and heat advice are not utility notices or exercises.
  assert.equal(classifyLocal("Ostrzeżenie meteorologiczne: silny wiatr", "Możliwe przerwy w dostawie energii."), null);
  assert.equal(classifyLocal("Upał", "Unikaj ćwiczeń fizycznych w godzinach południowych."), null);
  assert.equal(classifyLocal("Jakość powietrza — przekroczenia PM10", ""), null);
  assert.equal(classifyLocal("Ostrzeżenie hydrologiczne — wezbranie z przekroczeniem stanów ostrzegawczych", "stan wody"), null);
  assert.equal(classifyLocal("Utrudnienia drogowe na DK17", ""), null);
});

test("parsePlWindow: numeric dates, hours, month names, ranges, overnight", () => {
  const w = parsePlWindow("W dniu 15.10.2026 w godz. 8:00–14:00 nastąpi przerwa w dostawie prądu.", REF);
  assert.equal(w.start, warsawToUtc(2026, 10, 15, 8, 0));
  assert.equal(w.end, warsawToUtc(2026, 10, 15, 14, 0));

  const r = parsePlWindow("w dniach 14-15 października od 7.30 do 15.30", REF);
  assert.equal(r.start, warsawToUtc(2026, 10, 14, 7, 30));
  assert.equal(r.end, warsawToUtc(2026, 10, 15, 15, 30));

  const n = parsePlWindow("13.10.2026 od godz. 22:00 do 6:00", REF);
  assert.equal(n.start, warsawToUtc(2026, 10, 13, 22, 0));
  assert.equal(n.end, warsawToUtc(2026, 10, 14, 6, 0));

  const h = parsePlWindow("12.10.2026 r. w godzinach 9-13", REF);
  assert.equal(h.start, warsawToUtc(2026, 10, 12, 9, 0));
  assert.equal(h.end, warsawToUtc(2026, 10, 12, 13, 0));

  // The notice's own date stamp is ignored when a later date names the window.
  const stamp = parsePlWindow("Komunikat z dnia 01.10.2026: w dniu 16.10.2026 brak wody.", REF);
  assert.equal(stamp.start, warsawToUtc(2026, 10, 16, 0, 0));

  // No year: the nearest such date (January after an October notice is next year).
  // RSO "Syrena-26": "Od 12 do 16 października 2026" is a range, not just the 16th.
  const od = parsePlWindow("Od 12 do 16 października 2026 r. na terenie województwa mazowieckiego odbywać się będą ćwiczenia", REF);
  assert.equal(od.start, warsawToUtc(2026, 10, 12, 0, 0));
  assert.equal(od.end, warsawToUtc(2026, 10, 16, 23, 59));
  const jan = parsePlWindow("5 stycznia ćwiczenia", REF);
  assert.equal(jan.start, warsawToUtc(2027, 1, 5, 0, 0));

  assert.equal(parsePlWindow("Brak prądu w części miasta.", REF), null);
  assert.equal(parsePlWindow("Zdarzenie z 12.03.2019", REF), null); // far in the past → misread
});

test("toLocalItems: window, default lifetime, voivodeships, safe URL", () => {
  const items = toLocalItems(
    [
      { id: "a", title: "Planowane wyłączenie prądu", text: "15.10.2026 8:00-12:00, Rzeszów", ts: REF, url: "https://komunikaty.tvp.pl/x", voivodeships: [] },
      { id: "b", title: "Awaria wodociągu — brak wody", text: "", ts: REF, url: "javascript:alert(1)", voivodeships: ["lubelskie", "nope"] },
      { id: "c", title: "Zbiórka krwi", text: "", ts: REF, voivodeships: ["lubelskie"] },
    ],
    REF
  );
  assert.equal(items.length, 2);
  const [a, b] = items;
  assert.equal(a.kind, "planned");
  assert.equal(a.window, "text");
  assert.deepEqual(a.voivodeships, ["podkarpackie"]);
  assert.equal(itemState(a, REF), "upcoming");
  assert.equal(b.kind, "outage");
  assert.equal(b.window, "default");
  assert.equal(Date.parse(b.ends_at) - REF, 24 * 3600_000);
  assert.equal(b.url, null);
  assert.deepEqual(b.voivodeships, ["lubelskie"]);
  assert.equal(itemState(b, REF + 3600_000), "active");
});

test("mapRso feeds local alerts from the same notices", () => {
  const payload = {
    newses: [
      {
        id: 101,
        title: "Przerwa w dostawie gazu",
        shortcut: "PSG: 16.10.2026 w godz. 9:00-15:00",
        content: "<p>Prace na sieci gazowej w gminie Chełm.</p>",
        updated_at: "2026-10-11 08:30:00",
        provinces: { 3: { slug_name: "lubelskie", name: "lubelskie" } },
      },
      { id: 102, title: "Ostrzeżenie meteorologiczne", shortcut: "Silny wiatr", content: "", updated_at: "2026-10-11 08:00:00", provinces: {} },
    ],
  };
  const out = mapRso(payload, REF);
  assert.equal(out.local.length, 1);
  const g = out.local[0];
  assert.equal(g.id, "rso-101");
  assert.equal(g.category, "gas");
  assert.equal(g.kind, "planned"); // works announced for a later date
  assert.deepEqual(g.voivodeships, ["lubelskie"]);
  assert.equal(g.starts_at, new Date(warsawToUtc(2026, 10, 16, 9, 0)).toISOString());
  assert.equal(g.url, "https://komunikaty.tvp.pl/komunikaty/101/detale");
});

test("local store keeps items until their window ends, then drops them", () => {
  const store = createLocalStore();
  const [it] = toLocalItems([{ id: "x", title: "Brak prądu", text: "", ts: REF }], REF);
  store.merge([it], REF);
  assert.equal(store.snapshot(REF).items.length, 1);
  assert.equal(store.snapshot(REF).items[0].state, "active");
  store.merge([], REF + 24 * 3600_000 + 3 * 3600_000);
  assert.equal(store.snapshot(REF + 24 * 3600_000 + 3 * 3600_000).items.length, 0);
});
