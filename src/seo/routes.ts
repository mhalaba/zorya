/**
 * Public routes with their SEO metadata. One source of truth for: prerendered HTML (scripts/prerender.mjs),
 * the sitemap, the server's route → file map, and client-side <head> updates on navigation.
 * Only truthful claims about features and sources.
 */
export const SITE = "https://zorya.website";
export const OG_IMAGE = `${SITE}/og-image-1200x630.png`;
export const OG_IMAGE_ALT =
  "Zorya: mapa zagrożeń z powietrza dla Polski. Alerty dronów, alarmy, RSO i rakiety nad Ukrainą z otwartych źródeł.";

export interface SeoRoute {
  path: string;
  /** File name in dist/seo/ */
  file: string;
  lang: "pl" | "en";
  title: string;
  description: string;
  /** hreflang alternates: lang → path */
  alternates?: Record<string, string>;
  robots?: string;
  sitemap?: { changefreq: string; priority: number } | null;
  /** Page kind for JSON-LD */
  kind: "home" | "app" | "about" | "page";
}

export const ROUTES: SeoRoute[] = [
  {
    path: "/",
    file: "index",
    lang: "pl",
    title: "Zorya: mapa zagrożeń z powietrza dla Polski, alerty dronów na żywo",
    description:
      "Bezpłatna mapa zagrożeń powietrznych dla Polski: drony i rakiety nad Ukrainą (NEPTUN, MAPA.UA), alarmy w obwodach UA, komunikaty RSO / Alert RCB i ADS-B. Ocena dla każdego z 16 województw.",
    sitemap: { changefreq: "weekly", priority: 1 },
    kind: "home",
  },
  {
    path: "/app/mapa",
    file: "app-mapa",
    lang: "pl",
    title: "Mapa na żywo: drony nad Polską i Ukrainą, alerty RSO — Zorya",
    description:
      "Mapa na żywo: poziom zagrożenia z powietrza dla województw, drony i pociski nad Ukrainą (OSINT), rakiety z MAPA.UA, alarmy w obwodach UA, komunikaty RSO / Alert RCB i ruch ADS-B.",
    sitemap: { changefreq: "always", priority: 0.9 },
    kind: "app",
  },
  {
    path: "/o-projekcie",
    file: "o-projekcie",
    lang: "pl",
    title: "O projekcie Zorya: skąd dane o dronach i alertach, jak liczymy poziom",
    description:
      "Czym jest Zorya, skąd bierze dane (NEPTUN, alarmy UA, ADS-B, RSO / Alert RCB, media, MAPA.UA), jak ocenia województwa i jakie ma ograniczenia. To nie jest oficjalny system ostrzegania.",
    alternates: { pl: "/o-projekcie", en: "/en/about", "x-default": "/o-projekcie" },
    sitemap: { changefreq: "monthly", priority: 0.8 },
    kind: "about",
  },
  {
    path: "/en/about",
    file: "en-about",
    lang: "en",
    title: "About Zorya: a free air-threat map for Poland (drones, missiles, alerts)",
    description:
      "Zorya combines open data on drones and missiles over Ukraine (NEPTUN, MAPA.UA), Ukrainian air-raid alerts, Polish RSO / RCB notices and ADS-B into a per-voivodeship view. Not an official warning system.",
    alternates: { pl: "/o-projekcie", en: "/en/about", "x-default": "/o-projekcie" },
    sitemap: { changefreq: "monthly", priority: 0.7 },
    kind: "about",
  },
  {
    path: "/jak-dziala",
    file: "jak-dziala",
    lang: "pl",
    title: "Jak działa Zorya: punkty dla województw, alarmy UA i komunikaty RSO",
    description:
      "Jak Zorya łączy sygnały z ostatnich 60 minut w poziom dla województwa: typ obiektu, odległość od granicy, kierunek lotu, alarmy w obwodach Ukrainy i komunikaty RSO.",
    sitemap: { changefreq: "monthly", priority: 0.7 },
    kind: "page",
  },
  {
    path: "/zrodla",
    file: "zrodla",
    lang: "pl",
    title: "Źródła danych i licencje — Zorya",
    description:
      "Skąd Zorya bierze dane o zagrożeniach z powietrza: NEPTUN (OSINT), alarmy UA, ADS-B (adsb.lol), RSO / Alert RCB, media RMF24 i PAP, MAPA.UA. Licencje mapy i czcionek.",
    sitemap: { changefreq: "monthly", priority: 0.5 },
    kind: "page",
  },
  {
    path: "/prywatnosc",
    file: "prywatnosc",
    lang: "pl",
    title: "Prywatność — Zorya",
    description: "Zorya działa bez konta, bez numeru telefonu i bez reklam. Lokalizacja zostaje na telefonie.",
    sitemap: { changefreq: "yearly", priority: 0.3 },
    kind: "page",
  },
  {
    path: "/kontakt",
    file: "kontakt",
    lang: "pl",
    title: "Kontakt — Zorya",
    description: "Kontakt z autorem mapy zagrożeń z powietrza Zorya: m@zorya.website. Kod źródłowy na GitHubie.",
    sitemap: { changefreq: "yearly", priority: 0.3 },
    kind: "page",
  },
  {
    path: "/status",
    file: "status",
    lang: "pl",
    title: "Status źródeł — Zorya",
    description: "Stan źródeł danych Zorya na żywo.",
    robots: "noindex, follow",
    sitemap: null,
    kind: "page",
  },
];

export const NOT_FOUND: SeoRoute = {
  path: "/404",
  file: "404",
  lang: "pl",
  title: "Nie ma takiej strony — Zorya",
  description: "Nie ma takiej strony. Mapa zagrożeń z powietrza jest pod /app/mapa.",
  robots: "noindex, follow",
  sitemap: null,
  kind: "page",
};

export function routeFor(path: string): SeoRoute | null {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p === "/index.html") return ROUTES.find((r) => r.path === "/") ?? null;
  if (p === "/about") return ROUTES.find((r) => r.path === "/en/about") ?? null;
  if (p.startsWith("/app")) return ROUTES.find((r) => r.path === "/app/mapa") ?? null;
  return ROUTES.find((r) => r.path === p) ?? null;
}

const PUBLISHER = {
  "@type": "Organization",
  "@id": `${SITE}/#publisher`,
  name: "Baiame Mateusz Halaba",
  url: SITE,
  email: "m@zorya.website",
  founder: { "@type": "Person", name: "Mateusz Halaba", alternateName: "Matthew Halaba" },
  contactPoint: { "@type": "ContactPoint", email: "m@zorya.website", contactType: "customer support", availableLanguage: ["pl", "en"] },
  sameAs: ["https://github.com/mhalaba/zorya"],
};

/** JSON-LD graph for one route. */
export function jsonLd(r: SeoRoute): object {
  const url = `${SITE}${r.path === "/" ? "/" : r.path}`;
  const graph: object[] = [
    PUBLISHER,
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: `${SITE}/`,
      name: "Zorya",
      alternateName: "Zorya — czuwanie świtu",
      inLanguage: ["pl", "en"],
      publisher: { "@id": `${SITE}/#publisher` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE}/#app`,
      name: "Zorya — mapa zagrożeń z powietrza",
      url: `${SITE}/app/mapa`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web, Android, iOS (PWA)",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "PLN" },
      inLanguage: "pl",
      description:
        "Mapa na żywo z oceną zagrożenia z powietrza dla 16 województw: drony i pociski nad Ukrainą (NEPTUN, MAPA.UA), alarmy w obwodach UA, komunikaty RSO / Alert RCB, ADS-B.",
      publisher: { "@id": `${SITE}/#publisher` },
    },
    {
      "@type": r.kind === "about" ? "AboutPage" : "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: r.title,
      description: r.description,
      inLanguage: r.lang,
      isPartOf: { "@id": `${SITE}/#website` },
      publisher: { "@id": `${SITE}/#publisher` },
      ...(r.kind === "app" || r.kind === "home" ? { mainEntity: { "@id": `${SITE}/#app` } } : {}),
    },
  ];
  return { "@context": "https://schema.org", "@graph": graph };
}
