import { NOT_FOUND, ROUTES, SITE, routeFor } from "./routes";

function meta(sel: string, attr: "name" | "property", key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/** Keep <title>, description, canonical and lang in sync on client-side navigation. */
export function syncHead(path: string) {
  const known = ROUTES.some((r) => r.path === path) || path === "/about" || path.startsWith("/app");
  const r = routeFor(path) ?? (known ? null : NOT_FOUND);
  if (!r) return;
  document.title = r.title;
  document.documentElement.lang = r.lang;
  meta('meta[name="description"]', "name", "description", r.description);
  meta('meta[property="og:title"]', "property", "og:title", r.title);
  meta('meta[property="og:description"]', "property", "og:description", r.description);
  meta('meta[property="og:url"]', "property", "og:url", `${SITE}${r.path}`);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (r.robots?.includes("noindex")) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = `${SITE}${r.path === "/" ? "/" : r.path}`;
}
