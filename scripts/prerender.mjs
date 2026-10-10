// Build step after `vite build` + `vite build --ssr`: writes dist/seo/<file>.html (route-specific <head> + static
// body text for crawlers), dist/robots.txt and dist/sitemap.xml. The client still mounts with createRoot and
// replaces the static body, so behaviour for users does not change.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssr = await import(pathToFileURL(path.join(root, "dist-ssr", "prerender-entry.js")).href);
const { ROUTES, NOT_FOUND, jsonLd, render } = ssr;
const SITE = "https://zorya.website";
const tpl = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const abs = (p) => `${SITE}${p === "/" ? "/" : p}`;

function head(r) {
  const out = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}" />`,
    `<meta name="robots" content="${esc(r.robots || "index, follow, max-image-preview:large")}" />`,
  ];
  if (!r.robots?.includes("noindex")) out.push(`<link rel="canonical" href="${abs(r.path)}" />`);
  for (const [l, p] of Object.entries(r.alternates || {})) out.push(`<link rel="alternate" hreflang="${l}" href="${abs(p)}" />`);
  out.push(
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Zorya" />`,
    `<meta property="og:url" content="${abs(r.path)}" />`,
    `<meta property="og:title" content="${esc(r.title)}" />`,
    `<meta property="og:description" content="${esc(r.description)}" />`,
    `<meta property="og:image" content="${SITE}/og-image-1200x630.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(ssr.OG_IMAGE_ALT || "Zorya: mapa zagrożeń z powietrza dla Polski")}" />`,
    `<meta property="og:locale" content="${r.lang === "en" ? "en_GB" : "pl_PL"}" />`,
    `<meta property="og:locale:alternate" content="${r.lang === "en" ? "pl_PL" : "en_GB"}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(r.title)}" />`,
    `<meta name="twitter:description" content="${esc(r.description)}" />`,
    `<meta name="twitter:image" content="${SITE}/og-image-1200x630.png" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd(r)).replace(/</g, "\\u003c")}</script>`
  );
  return out.join("\n    ");
}

// Strip the template's generic SEO tags; route-specific ones replace them.
const base = tpl
  .replace(/<title>[\s\S]*?<\/title>\s*/, "")
  .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, "")
  .replace(/<meta\s+property="og:[^"]+"[\s\S]*?\/>\s*/g, "")
  .replace(/<meta\s+name="twitter:[^"]+"[\s\S]*?\/>\s*/g, "");

const outDir = path.join(dist, "seo");
fs.mkdirSync(outDir, { recursive: true });
const map = {};
for (const r of [...ROUTES, NOT_FOUND]) {
  const html = base
    .replace(/<html lang="[^"]*"/, `<html lang="${r.lang}"`)
    .replace("</head>", `    ${head(r)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${render(r.path)}</div>`);
  fs.writeFileSync(path.join(outDir, `${r.file}.html`), html);
  map[r.path] = `${r.file}.html`;
}
fs.writeFileSync(path.join(outDir, "routes.json"), JSON.stringify(map, null, 2));

const today = new Date().toISOString().slice(0, 10);
const urls = ROUTES.filter((r) => r.sitemap).map((r) => {
  const alt = Object.entries(r.alternates || {})
    .map(([l, p]) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${abs(p)}"/>`)
    .join("");
  return `  <url>\n    <loc>${abs(r.path)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${r.sitemap.changefreq}</changefreq>\n    <priority>${r.sitemap.priority.toFixed(1)}</priority>${alt}\n  </url>`;
});
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`
);
fs.writeFileSync(
  path.join(dist, "robots.txt"),
  [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n")
);
fs.rmSync(path.join(root, "dist-ssr"), { recursive: true, force: true });
console.log(`prerendered ${Object.keys(map).length} routes, sitemap ${urls.length} urls`);
