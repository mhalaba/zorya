import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { s } from "../strings";
import { fmtTime } from "../format";
import { fetchStatus, landingHeroHorizon } from "../api";
import type { StatusPayload } from "../model";
import { LevelGlyph } from "../components/ui";
import { ABOUT_EN, ABOUT_PL, type AboutCopy } from "./about";

function lockupSrc(theme: "noc" | "dzien", tagline = false) {
  if (tagline) return theme === "dzien" ? "/icons/zorya-lockup-h-tagline-day.svg" : "/icons/zorya-lockup-h-tagline-night.svg";
  return theme === "dzien" ? "/icons/zorya-lockup-h-day.svg" : "/icons/zorya-lockup-h-night.svg";
}

function useSiteTheme(): "noc" | "dzien" {
  const [t, setT] = useState<"noc" | "dzien">("noc");
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dzien" || attr === "noc") setT(attr);
    else setT(window.matchMedia("(prefers-color-scheme: light)").matches ? "dzien" : "noc");
  }, []);
  return t;
}

export function SiteHeader() {
  const theme = useSiteTheme();
  return (
    <header className="top">
      <a className="brand" href="/" aria-label={s("brand.name")}>
        <img src={lockupSrc(theme)} alt={s("brand.name")} height={24} />
      </a>
      <nav aria-label="Menu">
        <a href="/o-projekcie">{s("web.menu_about")}</a>
        <a href="/jak-dziala">{s("web.menu_how")}</a>
        <a href="/zrodla">{s("web.menu_sources")}</a>
        <a href="/prywatnosc">{s("web.menu_privacy")}</a>
        <a href="/status">{s("web.menu_status")}</a>
        <a className="btn" href="/app/mapa" style={{ height: 40 }}>
          {s("web.open_app")}
        </a>
      </nav>
    </header>
  );
}

export function SiteFooter({ status }: { status?: StatusPayload | null }) {
  const theme = useSiteTheme();
  const date = status?.data_as_of ? status.data_as_of.slice(0, 10) : "2026-09-20";
  const time = status?.data_as_of ? fmtTime(status.data_as_of) : "05:41";
  const total = status?.sources.length || 5;
  const active = status?.sources.filter((x) => x.enabled && x.health === "fresh").length ?? total;
  return (
    <footer className="site-foot" id="status">
      <div>
        <div className="cobrand">
          <img src={theme === "dzien" ? "/icons/zorya-mark-day.svg" : "/icons/zorya-mark-night.svg"} alt="" height={28} />
          <span className="rule" />
          <img src="/icons/fundacja-terra-incognita.svg" alt={s("pages.foundation_line")} height={28} />
        </div>
        <div style={{ marginTop: 12 }}>
          {s("web.footer_line", { v: status?.version ?? "0.1", date })}
        </div>
        <div>{s("web.footer_status", { active, total, time })}</div>
        <div className="note">{s("pages.foundation_line")}. {s("pages.foundation_krs")}</div>
      </div>
      <div className="lk">
        <a href="/o-projekcie">O projekcie</a>
        <a href="/en/about">About (English)</a>
        <a href="/jak-dziala">Jak działa</a>
        <a href="/zrodla">Źródła danych i licencje</a>
        <a href="/prywatnosc">Polityka prywatności</a>
        <a href="https://github.com/mhalaba/zorya">Kod źródłowy</a>
        <a href="/kontakt">Kontakt</a>
        <a href="mailto:m@zorya.website">m@zorya.website</a>
      </div>
    </footer>
  );
}

function HorizonDiagram() {
  return (
    <div className="horizon-diagram" aria-hidden>
      <svg viewBox="0 0 520 200">
        <text x="0" y="16" fontSize="12" letterSpacing="1" fill="var(--z-text-2)" fontFamily="var(--z-font-ui)">
          NAD HORYZONTEM · ZDARZENIA
        </text>
        <rect x="0" y="30" width="520" height="44" fill="var(--z-bg-raised)" stroke="var(--z-status-obserwacja)" />
        <circle cx="24" cy="52" r="6" fill="var(--z-status-obserwacja)" />
        <text x="40" y="57" fontSize="14" fill="var(--z-text)" fontFamily="var(--z-font-ui)" fontWeight="700">
          RSO: zagrożenie z powietrza · lubelskie
        </text>
        <rect x="0" y="98" width="520" height="2" fill="var(--z-line-strong)" />
        <text x="520" y="118" textAnchor="end" fontSize="12" letterSpacing="1" fill="var(--z-text-2)" fontFamily="var(--z-font-ui)">
          HORYZONT
        </text>
        <g fontSize="13" fill="var(--z-text-2)" fontFamily="var(--z-font-ui)">
          <line x1="0" y1="140" x2="520" y2="140" stroke="var(--z-line-strong)" strokeDasharray="4 3" />
          <text x="0" y="135">NEPTUN · dron · ok. 180 km od granicy · ±20 km</text>
          <line x1="0" y1="170" x2="520" y2="170" stroke="var(--z-line-strong)" strokeDasharray="4 3" />
          <text x="0" y="165">alarm powietrzny UA · obwód wołyński</text>
          <line x1="0" y1="198" x2="520" y2="198" stroke="var(--z-line-strong)" strokeDasharray="1 3" />
          <text x="0" y="193">media · RMF24 · niepotwierdzone</text>
        </g>
      </svg>
    </div>
  );
}

export function Landing() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const hero = landingHeroHorizon();
  const sample = true;

  useEffect(() => {
    void fetchStatus().then(setStatus).catch(() => undefined);
  }, []);

  const ev = hero.events[0];
  const sigs = hero.signals.slice(0, 2);

  return (
    <div className="site">
      <SiteHeader />
      <section className="hero">
        <div>
          <h1 className="z-display">{s("web.hero_title")}</h1>
          <p>{s("web.hero_text")}</p>
          <div className="cta">
            <a className="btn primary" href="/app/mapa">
              {s("web.open_app")}
            </a>
            <a className="btn" href="#jak">
              {s("web.hero_secondary")}
            </a>
          </div>
        </div>
        <div className="demo" aria-label={sample ? s("web.sample") : s("nav.horyzont")}>
          {sample && <span className="sample-tag">{s("web.sample")}</span>}
          <div className="st">
            <LevelGlyph level="obserwacja" size="hero" />
            <div>
              <div className="w lvl-obserwacja">{s("levels.obserwacja_cap")}</div>
              <div className="m">województwo lubelskie · od 04:52 · 5 z 5 źródeł aktywnych</div>
            </div>
          </div>
          {ev && (
            <div className="ev">
              <div className="k">
                <LevelGlyph level="obserwacja" size="card" />
                obserwacja · 04:52
              </div>
              <b>{ev.title}</b>
              <span style={{ color: "var(--z-text-2)" }}>alarmy UA · jedno źródło · bez potwierdzenia</span>
            </div>
          )}
          <div className="sub">
            {sigs.map((sg) => (
              <span key={sg.id}>
                <span className="mono">{fmtTime(sg.observed_at)}</span> {sg.text}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="band" id="jak">
        <h2>Jak działa</h2>
        <div className="three">
          <div>
            <h3>Zbiera</h3>
            <p>Pięć otwartych źródeł, sprawdzanych co 60 sekund, każde z własnym znacznikiem czasu i stanem: NEPTUN (OSINT z Ukrainy), alarmy powietrzne UA, ADS-B, RSO / Alert RCB i media.</p>
          </div>
          <div>
            <h3>Łączy</h3>
            <p>Każde województwo dostaje punkty z ostatnich 60 minut: typ obiektu, odległość od granicy, kierunek lotu, pewność źródła. Komunikat RSO o zagrożeniu z powietrza od razu daje najwyższy poziom.</p>
          </div>
          <div>
            <h3>Pokazuje</h3>
            <p>Mapę na żywo: województwa w trzech stanach (spokój, uwaga, priorytet), obwody Ukrainy z alarmem, obiekty z kołem niepewności i samoloty z ADS-B. Zawsze z podanym źródłem.</p>
          </div>
        </div>
      </section>
      <section className="band">
        <h2>Trzy stany na mapie</h2>
        <div className="levels">
          <div>
            <LevelGlyph level="cisza" size="hero" />
            <b>spokój</b>
            <small>Brak sygnałów w ostatniej godzinie albo są daleko od granicy.</small>
          </div>
          <div>
            <LevelGlyph level="ostrzezenie" size="hero" />
            <b>uwaga</b>
            <small>Sygnały z ostatniej godziny przekraczają próg dla województwa. Sprawdź oficjalne komunikaty.</small>
          </div>
          <div>
            <LevelGlyph level="alarm" size="hero" />
            <b>priorytet</b>
            <small>Wysoki wynik albo komunikat RSO o zagrożeniu z powietrza dla województwa. Stosuj się do poleceń służb.</small>
          </div>
        </div>
      </section>
      <section className="band" id="zrodla">
        <h2>Źródła</h2>
        <div className="srcs">
          <div>
            <b>Oficjalne</b>
            <span>RSO / Alert RCB z komunikaty.tvp.pl: komunikaty o zagrożeniach z powietrza. Treść oryginalna zawsze w źródle.</span>
          </div>
          <div>
            <b>OSINT z Ukrainy</b>
            <span>NEPTUN (neptun.in.ua): śledzenie dronów i pocisków nad Ukrainą, nie radar. Do tego alarmy powietrzne w obwodach.</span>
          </div>
          <div>
            <b>Ruch lotniczy</b>
            <span>ADS-B z adsb.lol: samoloty nad Polską, które same nadają swoją pozycję.</span>
          </div>
          <div>
            <b>Media</b>
            <span>RSS RMF24 i PAP, tylko treści o zagrożeniach z powietrza. Same nie wystarczą, żeby podnieść poziom.</span>
          </div>
        </div>
      </section>
      <section className="band" id="prywatnosc">
        <div className="how">
          <div>
            <h2>Prywatność</h2>
            <p style={{ fontSize: 20, lineHeight: "30px", color: "var(--z-text)" }}>
              Zorya nie ma konta, nie ma numeru telefonu i nie ma reklam. Lokalizacja zostaje na telefonie; serwer dostaje tylko nazwę gminy. Serwer stoi w Polsce, kod jest otwarty.
            </p>
          </div>
          <HorizonDiagram />
        </div>
      </section>
      <SiteFooter status={status} />
    </div>
  );
}

export function SitePage({ title, children }: { title: string; children: ReactNode }) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => {
    void fetchStatus().then(setStatus).catch(() => undefined);
  }, []);
  return (
    <div className="site">
      <SiteHeader />
      <article className="page">
        <h1 className="z-h1">{title}</h1>
        {children}
      </article>
      <SiteFooter status={status} />
    </div>
  );
}

export function HowPage() {
  return (
    <SitePage title={s("pages.how_title")}>
      <p className="lead">{s("web.hero_text")}</p>
      <h2 className="z-h2">Zbiera</h2>
      <p>Pięć otwartych źródeł, sprawdzanych co 60 sekund, każde z własnym znacznikiem czasu i stanem: NEPTUN (OSINT z Ukrainy), alarmy powietrzne UA, ADS-B, RSO / Alert RCB i media.</p>
      <h2 className="z-h2">Łączy</h2>
      <p>Każde województwo dostaje punkty z ostatnich 60 minut: typ obiektu, odległość od granicy, kierunek lotu, pewność źródła. Komunikat RSO o zagrożeniu z powietrza od razu daje najwyższy poziom.</p>
      <h2 className="z-h2">Pokazuje</h2>
      <p>Mapę na żywo: województwa w trzech stanach (spokój, uwaga, priorytet), obwody Ukrainy z alarmem, obiekty z kołem niepewności i samoloty z ADS-B. Zawsze z podanym źródłem.</p>
      <h2 className="z-h2">{s("sources.how")}</h2>
      <p>{s("sources.how_text")}</p>
    </SitePage>
  );
}

export function PrivacyPage() {
  return (
    <SitePage title={s("pages.privacy_title")}>
      <p className="lead">
        Zorya nie ma konta, nie ma numeru telefonu i nie ma reklam. Lokalizacja zostaje na telefonie; serwer dostaje tylko nazwę gminy. Serwer stoi w Polsce, kod jest otwarty.
      </p>
      <p>{s("pages.privacy_fields")}</p>
      <p>{s("pages.unofficial")}</p>
    </SitePage>
  );
}

export function StatusPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => {
    void fetchStatus().then(setStatus).catch(() => undefined);
  }, []);
  return (
    <SitePage title={s("pages.status_title")}>
      {status?.sample && <p className="sample-tag">{s("web.sample")}</p>}
      <p>
        {s("web.footer_status", {
          active: status?.sources.filter((x) => x.health === "fresh").length ?? 0,
          total: status?.sources.length ?? 0,
          time: status ? fmtTime(status.data_as_of) : s("home.loading"),
        })}
      </p>
      <div className="list">
        {(status?.sources ?? []).map((src) => (
          <div className="li" key={src.id}>
            <span className="t">{src.name}</span>
            <span className="d">{src.description}</span>
            <span className="r">{src.last_update ? fmtTime(src.last_update) : s("sources.health_disabled")}</span>
          </div>
        ))}
      </div>
    </SitePage>
  );
}

export function SourcesPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  useEffect(() => {
    void fetchStatus().then(setStatus).catch(() => undefined);
  }, []);
  return (
    <SitePage title={s("pages.sources_title")}>
      {(status?.sources ?? []).map((src) => (
        <p key={src.id}>
          <b>{src.name}.</b> {src.attribution || src.description}
        </p>
      ))}
      <p>
        <b>Mapa.</b> Podkład OpenFreeMap, dane © współtwórcy OpenStreetMap (ODbL). Granice obwodów Ukrainy: GADM.
      </p>
      <p>
        <b>Czcionki.</b> {s("pages.licences_fonts")}
      </p>
      <p>{s("pages.unofficial")}</p>
    </SitePage>
  );
}

export function ContactPage() {
  return (
    <SitePage title={s("pages.contact_title")}>
      <p>
        E-mail: <a href={`mailto:${s("pages.contact_email")}`}>{s("pages.contact_email")}</a>
      </p>
      <p>
        <a href="https://github.com/mhalaba/zorya">{s("settings.source_code")}</a>
      </p>
      <p>
        {s("pages.foundation_line")}. {s("pages.foundation_krs")}
      </p>
    </SitePage>
  );
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, i) => {
    if (!chunk) return;
    const bold = chunk.startsWith("**") && chunk.endsWith("**");
    const body = bold ? chunk.slice(2, -2) : chunk;
    const parts = body.split(/(m@zorya\.website|github\.com\/mhalaba\/zorya)/g).map((part, j) => {
      if (part === "m@zorya.website") return <a key={j} href="mailto:m@zorya.website">{part}</a>;
      if (part === "github.com/mhalaba/zorya") return <a key={j} href="https://github.com/mhalaba/zorya">{part}</a>;
      return part;
    });
    out.push(bold ? <b key={i}>{parts}</b> : <span key={i}>{parts}</span>);
  });
  return out;
}

export function AboutPage({ lang }: { lang: "pl" | "en" }) {
  const copy: AboutCopy = lang === "en" ? ABOUT_EN : ABOUT_PL;
  useEffect(() => {
    document.title = lang === "en" ? "About — Zorya" : "O projekcie — Zorya";
    document.documentElement.lang = lang;
    return () => {
      document.title = "Zorya — czuwanie świtu";
      document.documentElement.lang = "pl";
    };
  }, [lang]);
  return (
    <SitePage title={copy.title}>
      <p className="about-switch">
        <a href={copy.switchHref} hrefLang={lang === "en" ? "pl" : "en"}>
          {copy.switchLabel}
        </a>
      </p>
      {copy.blocks.map((b, i) => {
        if (b.t === "h2") return <h2 className="z-h2" key={i}>{b.text}</h2>;
        if (b.t === "lead") return <p className="lead" key={i}>{renderInline(b.text)}</p>;
        if (b.t === "warn") return <p className="about-warn" key={i}>{renderInline(b.text)}</p>;
        if (b.t === "ul")
          return (
            <ul className="about-list" key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{renderInline(b.text)}</p>;
      })}
    </SitePage>
  );
}
