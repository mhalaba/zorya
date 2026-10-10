/** SSR entry used only at build time (scripts/prerender.mjs): static HTML of public pages for crawlers. */
import { renderToStaticMarkup } from "react-dom/server";
import { AboutPage, ContactPage, HowPage, Landing, PrivacyPage, SourcesPage, StatusPage, NotFoundPage, SiteHeader, SiteFooter } from "../site/Site";
import { ROUTES, NOT_FOUND, jsonLd } from "./routes";

export { ROUTES, NOT_FOUND, jsonLd };
export { OG_IMAGE_ALT } from "./routes";

const VOIV =
  "dolnośląskie, kujawsko-pomorskie, lubelskie, lubuskie, łódzkie, małopolskie, mazowieckie, opolskie, podkarpackie, podlaskie, pomorskie, śląskie, świętokrzyskie, warmińsko-mazurskie, wielkopolskie, zachodniopomorskie";

/** What crawlers (and users without JS) see on /app/mapa before the map loads. */
function AppStatic() {
  return (
    <div className="site">
      <SiteHeader />
      <article className="page">
        <h1 className="z-h1">Mapa zagrożeń z powietrza na żywo</h1>
        <p className="lead">
          Mapa pokazuje poziom zagrożenia z powietrza dla każdego z 16 województw, drony i pociski śledzone nad Ukrainą
          (NEPTUN, OSINT), rakiety z MAPA.UA, obwody Ukrainy z aktywnym alarmem lotniczym, komunikaty RSO / Alert RCB i
          samoloty z ADS-B. Po kliknięciu województwa widać, jakie alerty są aktywne i dlaczego.
        </p>
        <p>Województwa: {VOIV}.</p>
        <p>Mapa wymaga JavaScriptu i WebGL. To nie jest oficjalny system ostrzegania: nie zastępuje syren, Alertu RCB ani RSO.</p>
        <p>
          <a href="/o-projekcie">Jak to działa i skąd są dane</a>
        </p>
      </article>
      <SiteFooter />
    </div>
  );
}

export function render(path: string): string {
  const el =
    path === "/" ? <Landing /> :
    path === "/app/mapa" ? <AppStatic /> :
    path === "/o-projekcie" ? <AboutPage lang="pl" /> :
    path === "/en/about" ? <AboutPage lang="en" /> :
    path === "/jak-dziala" ? <HowPage /> :
    path === "/zrodla" ? <SourcesPage /> :
    path === "/prywatnosc" ? <PrivacyPage /> :
    path === "/kontakt" ? <ContactPage /> :
    path === "/status" ? <StatusPage /> :
    <NotFoundPage />;
  return renderToStaticMarkup(el);
}
