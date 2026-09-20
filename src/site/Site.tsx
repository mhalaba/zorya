import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { s } from "../strings";
import { fmtTime } from "../format";
import { fetchStatus, landingHeroHorizon } from "../api";
import type { StatusPayload } from "../model";
import { LevelGlyph } from "../components/ui";

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
        <a href="/jak-dziala">{s("web.menu_how")}</a>
        <a href="/zrodla">{s("web.menu_sources")}</a>
        <a href="/prywatnosc">{s("web.menu_privacy")}</a>
        <a href="/status">{s("web.menu_status")}</a>
        <a className="btn" href="/app" style={{ height: 40 }}>
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
  const active = status?.sources.filter((x) => x.enabled && x.health === "fresh").length ?? 6;
  const total = 6;
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
        <a href="/jak-dziala">Jak działa</a>
        <a href="/zrodla">Źródła danych i licencje</a>
        <a href="/prywatnosc">Polityka prywatności</a>
        <a href="https://github.com/mhalaba/zorya">Kod źródłowy</a>
        <a href="/kontakt">Kontakt</a>
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
          Ostrzeżenie IMGW: silny wiatr
        </text>
        <rect x="0" y="98" width="520" height="2" fill="var(--z-line-strong)" />
        <text x="520" y="118" textAnchor="end" fontSize="12" letterSpacing="1" fill="var(--z-text-2)" fontFamily="var(--z-font-ui)">
          HORYZONT
        </text>
        <g fontSize="13" fill="var(--z-text-2)" fontFamily="var(--z-font-ui)">
          <line x1="0" y1="140" x2="520" y2="140" stroke="var(--z-line-strong)" strokeDasharray="4 3" />
          <text x="0" y="135">czujnik nr 3 · sygnał ciągły 41 s</text>
          <line x1="0" y1="170" x2="520" y2="170" stroke="var(--z-line-strong)" strokeDasharray="4 3" />
          <text x="0" y="165">ADS-B · bez identyfikatora · 300 m AGL</text>
          <line x1="0" y1="198" x2="520" y2="198" stroke="var(--z-line-strong)" strokeDasharray="1 3" />
          <text x="0" y="193">zgłoszenie · „huk" · niezweryfikowane</text>
        </g>
      </svg>
    </div>
  );
}

export function Landing() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const hero = landingHeroHorizon();
  const sample = !status || status.sample !== false;

  useEffect(() => {
    void fetchStatus().then(setStatus);
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
            <a className="btn primary" href="/app">
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
              <div className="m">gmina Brzegowo · od 04:52 · 6 z 6 źródeł aktywnych</div>
            </div>
          </div>
          {ev && (
            <div className="ev">
              <div className="k">
                <LevelGlyph level="obserwacja" size="card" />
                obserwacja · 04:52
              </div>
              <b>{ev.title}</b>
              <span style={{ color: "var(--z-text-2)" }}>powiat brzegowski · do 21.09, 06:00 · prawdopodobne</span>
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
            <p>Sześć źródeł, każde z własnym znacznikiem czasu i stanem. Oficjalne komunikaty, czujniki, radio, zgłoszenia.</p>
          </div>
          <div>
            <h3>Łączy</h3>
            <p>Dwa niezależne źródła mówiące o tym samym miejscu i czasie to jedno zdarzenie. Jedno źródło zostaje pod horyzontem.</p>
          </div>
          <div>
            <h3>Mówi, co robić</h3>
            <p>Pięć poziomów, jedno słowo każdy. Przy alarmie trzy kroki, nie artykuł. Odwołanie też jest powiadomieniem.</p>
          </div>
        </div>
      </section>
      <section className="band">
        <h2>Pięć poziomów horyzontu</h2>
        <div className="levels">
          <div>
            <LevelGlyph level="cisza" size="hero" />
            <b>cisza</b>
            <small>Nic się nie dzieje. Wszystkie źródła raportują.</small>
          </div>
          <div>
            <LevelGlyph level="obserwacja" size="hero" />
            <b>obserwacja</b>
            <small>Jeden sygnał albo komunikat bez lokalnego potwierdzenia. Przeczytaj.</small>
          </div>
          <div>
            <LevelGlyph level="ostrzezenie" size="hero" />
            <b>ostrzeżenie</b>
            <small>Dwa źródła się zgadzają albo oficjalne ostrzeżenie dla Twojej gminy. Przygotuj się.</small>
          </div>
          <div>
            <LevelGlyph level="alarm" size="hero" />
            <b>alarm</b>
            <small>Alarm RCB albo syrena potwierdzona drugim źródłem. Działaj.</small>
          </div>
          <div>
            <LevelGlyph level="odwolanie" size="hero" />
            <b>odwołanie</b>
            <small>Zdarzenie odwołane lub wygasło. Po godzinie wracamy do ciszy.</small>
          </div>
        </div>
      </section>
      <section className="band" id="zrodla">
        <h2>Źródła</h2>
        <div className="srcs">
          <div>
            <b>Oficjalne</b>
            <span>Alert RCB, ostrzeżenia IMGW, komunikaty PSP. Treść oryginalna zawsze pod ręką.</span>
          </div>
          <div>
            <b>Syreny</b>
            <span>Czujniki akustyczne rozpoznają sygnał i odróżniają próbę od alarmu.</span>
          </div>
          <div>
            <b>Radio i powietrze</b>
            <span>ADS-B, skaner 433 i 868 MHz, radio publiczne. Sygnał bez identyfikatora to sygnał, nie wyrok.</span>
          </div>
          <div>
            <b>Sąsiedzi</b>
            <span>Anonimowe zgłoszenia, zaokrąglone do 500 m. Same nigdy nie podnoszą poziomu.</span>
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
    void fetchStatus().then(setStatus);
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
      <p>Sześć źródeł, każde z własnym znacznikiem czasu i stanem. Oficjalne komunikaty, czujniki, radio, zgłoszenia.</p>
      <h2 className="z-h2">Łączy</h2>
      <p>Dwa niezależne źródła mówiące o tym samym miejscu i czasie to jedno zdarzenie. Jedno źródło zostaje pod horyzontem.</p>
      <h2 className="z-h2">Mówi, co robić</h2>
      <p>Pięć poziomów, jedno słowo każdy. Przy alarmie trzy kroki, nie artykuł. Odwołanie też jest powiadomieniem.</p>
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
    void fetchStatus().then(setStatus);
  }, []);
  return (
    <SitePage title={s("pages.status_title")}>
      {status?.sample && <p className="sample-tag">{s("web.sample")}</p>}
      <p>
        {s("web.footer_status", {
          active: status?.sources.filter((x) => x.health === "fresh").length ?? 0,
          total: 6,
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
    void fetchStatus().then(setStatus);
  }, []);
  return (
    <SitePage title={s("pages.sources_title")}>
      {(status?.sources ?? []).map((src) => (
        <p key={src.id}>
          <b>{src.name}.</b> {src.attribution || src.description}
        </p>
      ))}
    </SitePage>
  );
}

export function ContactPage() {
  return (
    <SitePage title={s("pages.contact_title")}>
      <p>{s("pages.contact_email")}</p>
      <p>
        <a href="https://github.com/mhalaba/zorya">{s("settings.source_code")}</a>
      </p>
      <p>
        {s("pages.foundation_line")}. {s("pages.foundation_krs")}
      </p>
    </SitePage>
  );
}
