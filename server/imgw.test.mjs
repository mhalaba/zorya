// Run: node --test server/imgw.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { hydroItem, hydroItems, levelLabel, meteoItem, meteoItems } from "./imgw.mjs";
import { classifyLocal, createLocalStore } from "./local.mjs";
import { mapRso } from "./ingest.mjs";
import { warsawToUtc } from "./util.mjs";

const REF = warsawToUtc(2026, 10, 11, 9, 0);

const meteo = (o = {}) => ({
  id: "MET_2026_10_11_001",
  nazwa_zdarzenia: "Silny wiatr",
  stopien: "1",
  prawdopodobienstwo: "80",
  obowiazuje_od: "2026-10-11 08:00:00",
  obowiazuje_do: "2026-10-12 06:00:00",
  opublikowano: "2026-10-10 12:23:00",
  tresc: "Prognozuje się wystąpienie silnego wiatru o średniej prędkości od 30 km/h do 40 km/h, w porywach do 75 km/h.",
  komentarz: "",
  biuro: "BPKSiH Katowice",
  teryt: ["2466", "2402", "1201"],
  ...o,
});

const hydro = (o = {}) => ({
  opublikowano: "2026-10-10 10:00:00",
  "stopień": "1",
  data_od: "2026-10-11 00:00:00",
  data_do: "2026-10-12 12:00:00",
  prawdopodobienstwo: "75",
  numer: "12",
  biuro: "BPKSiH Kraków",
  zdarzenie: "Gwałtowne wzrosty stanów wody",
  przebieg: "W związku z prognozowanymi opadami deszczu przewiduje się wzrosty stanów wody.",
  komentarz: "",
  obszary: [
    { wojewodztwo: "małopolskie", opis: "Zlewnia Dunajca, małopolskie", kod_zlewni: "214" },
    { wojewodztwo: "śląskie", opis: "Zlewnia Soły, śląskie", kod_zlewni: "2132" },
  ],
  ...o,
});

test("meteoItem: level, window, voivodeships from TERYT, informational category", () => {
  const it = meteoItem(meteo(), REF);
  assert.equal(it.source, "imgw-meteo");
  assert.deepEqual(it.categories, ["meteo"]);
  assert.equal(it.kind, "warning");
  assert.equal(it.level, 1);
  assert.equal(it.title, "Silny wiatr — 1. stopień");
  assert.deepEqual(it.voivodeships, ["slaskie", "malopolskie"]);
  assert.equal(it.starts_at, new Date(warsawToUtc(2026, 10, 11, 8, 0)).toISOString());
  assert.equal(it.window, "source");
  assert.equal(it.until_cancelled, false);
  assert.match(it.summary, /Prawdopodobieństwo 80%/);
  assert.match(it.url, /imgw\.pl/);
});

test("meteoItem: ended or empty rows are dropped", () => {
  assert.equal(meteoItem(meteo({ obowiazuje_do: "2026-10-11 07:00:00" }), REF), null);
  assert.equal(meteoItem({}, REF), null);
  assert.equal(meteoItems([meteo(), meteo({ id: "x", stopien: "3" })], REF)[1].level, 3);
});

test("hydroItem: level 1 rises; voivodeships from area names", () => {
  const it = hydroItem(hydro(), REF);
  assert.equal(it.source, "imgw-hydro");
  assert.deepEqual(it.categories, ["hydro"]);
  assert.equal(it.level, 1);
  assert.match(it.title, /^Gwałtowne wzrosty stanów wody — 1\. stopień/);
  assert.deepEqual(it.voivodeships.sort(), ["malopolskie", "slaskie"]);
});

test("hydroItem: drought (-1, until cancelled) gets an open window and no level in the title", () => {
  const it = hydroItem(hydro({ zdarzenie: "Susza hydrologiczna", "stopień": "-1", data_do: "9999-12-31 23:59:59", obszary: [{ wojewodztwo: "łódzkie", opis: "Zlewnia Warty" }] }), REF);
  assert.equal(it.level, -1);
  assert.equal(it.until_cancelled, true);
  assert.equal(it.title, "Susza hydrologiczna (nr 12)");
  assert.deepEqual(it.voivodeships, ["lodzkie"]);
  assert.ok(Date.parse(it.ends_at) > REF + 20 * 86400_000);
  assert.equal(levelLabel(-1), "ostrzeżenie o suszy");
  // Stable across reads within a day: the store does not rewrite it every 10 min.
  assert.equal(hydroItem(hydro({ "stopień": "-1", data_do: "9999-12-31 23:59:59" }), REF).ends_at, hydroItem(hydro({ "stopień": "-1", data_do: "9999-12-31 23:59:59" }), REF + 600_000).ends_at);
  assert.equal(hydroItems([hydro(), null], REF).length, 1);
});

test("IMGW stays out of the RSO path (no duplicates) and out of the threat state", () => {
  // RSO re-posts of IMGW warnings are not local alerts…
  assert.equal(classifyLocal("Ostrzeżenie meteorologiczne IMGW: silny wiatr", "IMGW-PIB ostrzega"), null);
  assert.equal(classifyLocal("Ostrzeżenie hydrologiczne — wezbranie", "IMGW"), null);
  // …and an IMGW-only RSO feed raises no RCB air alert.
  const at = new Date().toISOString();
  const rso = mapRso({ newses: [{ id: 1, title: "Ostrzeżenie IMGW: burze z gradem", shortcut: "IMGW-PIB ostrzega przed burzami", content: "<p>IMGW</p>", created_at: at }] });
  assert.equal(rso.rcb.active, false);
  assert.equal((rso.local || []).length, 0);
});

test("store: IMGW sources are replaced as a whole", () => {
  const store = createLocalStore({ file: null });
  store.replaceSource("imgw-meteo", [meteoItem(meteo(), REF), meteoItem(meteo({ id: "B" }), REF)], REF);
  store.replaceSource("imgw-hydro", [hydroItem(hydro(), REF)], REF);
  store.replaceSource("imgw-meteo", [meteoItem(meteo({ id: "B" }), REF)], REF);
  const items = store.snapshot(REF).items;
  assert.deepEqual(items.map((x) => x.source).sort(), ["imgw-hydro", "imgw-meteo"]);
  assert.ok(items.every((x) => x.categories.every((c) => c === "meteo" || c === "hydro")));
});
