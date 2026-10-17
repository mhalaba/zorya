// Real-render check of /app/mapa in headless Chrome + SwiftShader WebGL (needs: npm i puppeteer-core; google-chrome).
// Prints hasImage for every mua-* icon, rendered mua-icon features, NEPTUN markers rendered, clicks one icon and saves screenshots.
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--window-size=1400,1000"] });
const p = await b.newPage();
await p.setViewport({ width: 1400, height: 1000 });
const errs = [];
p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errs.push(m.text().slice(0, 200)); });
await p.goto("https://zorya.website/app/mapa", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 15000));
const res = await p.evaluate(() => {
  const el = document.querySelector(".maplibregl-map");
  let map = null;
  for (let e = el; e && !map; e = e.parentElement) {
    const k = Object.keys(e).find((k) => k.startsWith("__reactFiber$"));
    for (let f = k && e[k]; f && !map; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && !map; h = h.next) {
        const v = h.memoizedState?.current;
        if (v && typeof v.getStyle === "function") map = v;
      }
    }
  }
  if (!map) return { error: "map not found" };
  window.__m = map;
  const types = ["drone", "jet", "banderol", "cruise", "ballistic", "bomb"];
  const icons = Object.fromEntries(types.flatMap((t) => [`mua-${t}`, `mua-${t}-dead`]).map((n) => [n, map.hasImage(n)]));
  const rendered = map.queryRenderedFeatures({ layers: ["mua-icon"] });
  const objR = map.getLayer("obj-icon") ? map.queryRenderedFeatures({ layers: ["obj-icon"] }) : [];
  return { layer: !!map.getLayer("mua-icon"), iconsizeOk: JSON.stringify(map.getLayoutProperty("mua-icon", "icon-size")).slice(0, 60),
    icons, srcFeatures: map.querySourceFeatures("mua").length, renderedIcons: rendered.length,
    sample: rendered.slice(0, 3).map((f) => ({ id: f.properties.id, icon: f.properties.icon, amount: f.properties.amount, xy: map.project(f.geometry.coordinates) })),
    neptunRenderedInUA: objR.length, zoom: map.getZoom() };
});
console.log(JSON.stringify(res, null, 1));
await p.screenshot({ path: "/workspace/zorya-compare/fix-render.png" });
if (res.sample?.[0]) {
  await p.mouse.click(res.sample[0].xy.x, res.sample[0].xy.y);
  await new Promise((r) => setTimeout(r, 1500));
  await p.screenshot({ path: "/workspace/zorya-compare/fix-popup.png" });
  console.log("popup text:", await p.evaluate(() => (document.querySelector(".maplibregl-popup, [class*=popup], [class*=Popup], [class*=detail]")?.innerText || "").slice(0, 300)));
}
console.log("console errors:", errs.slice(0, 8));
await b.close();
