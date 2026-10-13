// Run: node --test server/search.test.mjs   (no network: geocoder answers are parsed from samples)
import test from "node:test";
import assert from "node:assert/strict";
import { parseNominatim, parseUug, searchAdmin, uugQuery } from "./search.mjs";

test("names: exact, prefix, namesakes told apart by powiat or voivodeship", () => {
  assert.equal(searchAdmin("Lublin")[0].gmina, "0663011");
  assert.equal(searchAdmin("zakop")[0].name, "Zakopane");
  assert.equal(searchAdmin("osiek").filter((h) => h.name === "Osiek").length, 4); // all namesakes, with their powiat
  const o = searchAdmin("Osiek oświęcimski");
  assert.equal(o[0].powiat, "1213");
  assert.equal(searchAdmin("Osiek małopolskie")[0].voivodeship, "malopolskie");
  assert.match(searchAdmin("Bielsko")[0].context, /woj\. śląskie/);
  assert.deepEqual(searchAdmin("x"), []);
});

test("address normalised to UUG syntax", () => {
  assert.equal(uugQuery("Lublin Krakowskie Przedmieście 10/2, 20-002"), "Lublin, Krakowskie Przedmieście 10");
  assert.equal(uugQuery("ul. Marszałkowska 1 Warszawa"), "Warszawa, Marszałkowska 1");
  assert.equal(uugQuery("Bielsko-Biała 3 Maja 5"), "Bielsko-Biała, 3 Maja 5");
  assert.equal(uugQuery("Królewskie Brzeziny 13"), "Królewskie Brzeziny 13");
  assert.equal(uugQuery("Warszawa, al. Jerozolimskie 44 m. 3"), "Warszawa, Jerozolimskie 44");
});

test("UUG and Nominatim answers placed in their gmina", () => {
  const [a] = parseUug({
    type: "address",
    results: { 1: { city: "Warszawa", street: "ulica Stalowa", number: "1", teryt: "146501", code: "03-429", x: "21.0357", y: "52.2584" } },
  });
  assert.equal(a.type, "address");
  assert.equal(a.gmina, "1465011");
  assert.equal(a.lon, 21.0357);
  assert.deepEqual(parseUug({ type: "city", results: null }), []);
  const [n] = parseNominatim([{ lat: "51.2465", lon: "22.5684", name: "Lublin", display_name: "Lublin, lubelskie, Polska", boundingbox: ["51.14", "51.30", "22.45", "22.67"] }]);
  assert.equal(n.gmina, "0663011");
  assert.deepEqual(n.bbox, [22.45, 51.14, 22.67, 51.3]);
});

test("street prefixes are removed only as whole words (Polish letters included)", () => {
  assert.equal(uugQuery("Głos 5 Kraków"), "Kraków, Głos 5");
  assert.equal(uugQuery("Kraków al. Mickiewicza 30"), "Kraków, Mickiewicza 30");
});
