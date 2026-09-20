import { X } from "lucide-react";
import { useStore } from "../store";
import { t } from "../i18n";
import { GUIDE_URL, SUPPORT_URL, SOURCE_LABEL } from "../config";
import { diodeColor } from "../lib";

export function MoreView() {
  const lang = useStore((s) => s.lang);
  const setView = useStore((s) => s.setView);
  const state = useStore((s) => s.state);
  return (
    <section className="sheet panel panel-ornament">
      <div className="sheet-head">
        <h2>{t(lang, "more")}</h2>
        <button className="icon-btn" onClick={() => setView("map")} aria-label={t(lang, "close")}>
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body stack">
        <h3>{t(lang, "how")}</h3>
        <p className="muted">{t(lang, "howBody")}</p>
        <p className="tiny">{t(lang, "fusionNote")}</p>

        <h3>{t(lang, "scoring")}</h3>
        <p className="muted">{t(lang, "scoringIntro")}</p>
        <table className="table">
          <thead>
            <tr>
              <th>{lang === "en" ? "Source" : "Źródło"}</th>
              <th>cap</th>
              <th>{lang === "en" ? "How" : "Jak"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>NEPTUN</td>
              <td>8</td>
              <td>
                f(typ) × √n × f(0–250 km) × confidence × potwierdzenia × kurs-na-PL × lifecycle. Balistyczna ~3.0, MiG-31K ~2.6, manewrujący wysoki, Shahed średni, nieznany niski. 0 km ×1.7 … 250 km ×0.1. Rejon ×0.6, centroid ×0.5. ETA (wysoka pewność, ≥2 potw.): ≤10 min min. 2 pkt; ≤5 min min. 4 pkt.
              </td>
            </tr>
            <tr>
              <td>{lang === "en" ? "UA air alert" : "Alarm UA"}</td>
              <td>1</td>
              <td>{lang === "en" ? "Weight falls with oblast distance to the PL border (1.0 at border → ~0.08 at 320 km)." : "Waga maleje z odległością obwodu od granicy PL (1.0 przy granicy → ~0.08 przy 320 km)."}</td>
            </tr>
            <tr>
              <td>RCB / RSO</td>
              <td>2</td>
              <td>{lang === "en" ? "New air-threat RCB Alert +2. Cancellation zeros it. The only signal that can light crimson on its own with the threshold." : "Nowy Alert RCB o zagrożeniu z powietrza: +2. Odwołanie zeruje. Jedyny sygnał, który sam może zapalić czerwony razem z progiem."}</td>
            </tr>
            <tr>
              <td>RSS</td>
              <td>1</td>
              <td>0 / 0.5 / 1 — {lang === "en" ? "the server reads the body, not the title alone." : "serwer czyta treść, nie sam tytuł."}</td>
            </tr>
            <tr>
              <td>ADS-B</td>
              <td>0</td>
              <td>{lang === "en" ? "Information only: civilians over PL plus military on the flank. Routine traffic does not alarm." : "Informacyjnie: cywilne nad PL i wojskowe na flance. Rutynowy ruch nie alarmuje."}</td>
            </tr>
            <tr>
              <td>PAŻP</td>
              <td>1</td>
              <td>+0.5 {lang === "en" ? "only rare D/R/NPZ/ADHOC from the ground, <7 days, east/north. North may +1. TSA/TRA/ATZ = 0." : "tylko rzadkie D/R/NPZ/ADHOC od ziemi, nowe <7 dni, wschód/północ. Północ może +1. TSA/TRA/ATZ = 0."}</td>
            </tr>
            <tr>
              <td>{lang === "en" ? "Baltic" : "Bałtyk"}</td>
              <td>—</td>
              <td>{lang === "en" ? "Incident +0.5…1; public alarm 0.12–0.3. Full weight only podlaskie, Warmia, Pomerania; West Pomerania ×0.5. Last 30 min." : "Incydent +0.5…1; alarm ludności 0.12–0.3. Pełna waga: podlaskie, warmińsko-mazurskie, pomorskie; zachodniopomorskie ×0.5. Tylko 30 min."}</td>
            </tr>
            <tr>
              <td>NATO</td>
              <td>0.6</td>
              <td>+0.3 {lang === "en" ? "airspace closure (RO/EE/LT) — observational." : "(zamknięcie przestrzeni RO/EE/LT) — obserwacyjne."}</td>
            </tr>
            <tr>
              <td>{lang === "en" ? "Neighbour transfer" : "Transfer sąsiedzki"}</td>
              <td>—</td>
              <td>{lang === "en" ? "If a voivodeship has ≥2 OWN points (without RCB), 40% flows BFS to neighbours, min 0.1. Olive, no notification." : "Jeśli woj. ma ≥2 pkt WŁASNE (bez RCB), 40% spływa BFS do sąsiadów, min 0.1. Oliwkowy, bez powiadomienia."}</td>
            </tr>
          </tbody>
        </table>
        <p className="tiny">{t(lang, "neptunNote")}</p>

        <h3>{t(lang, "notDoes")}</h3>
        <p className="muted">{t(lang, "notDoesBody")}</p>
        <p>{t(lang, "disclaimerFull")}</p>

        <h3>{t(lang, "sources")}</h3>
        <p className="muted">{t(lang, "sourcesBody")}</p>
        <p>
          <a href="https://neptun.in.ua/" target="_blank" rel="noreferrer">
            Dane: mapa powietrznych zagrożeń — NEPTUN
          </a>
        </p>
        <p>
          <a href={GUIDE_URL} target="_blank" rel="noreferrer">
            {t(lang, "instruction")}
          </a>
        </p>

        <h3>{t(lang, "privacy")}</h3>
        <p className="muted">{t(lang, "privacyBody")}</p>

        <h3>{t(lang, "foundation")}</h3>
        <p className="muted">{t(lang, "foundationBody")}</p>
        <p className="tiny">{t(lang, "foundationUnofficial")}</p>

        <h3>{t(lang, "author")}</h3>
        <p>
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
            {t(lang, "coffee")}
          </a>
        </p>

        <h3>{t(lang, "sourceStatus")}</h3>
        {(state?.sources ?? []).map((s) => (
          <div key={s.id} className="row space">
            <span className="row">
              <span className={`dot ${s.diode}`} style={{ background: diodeColor(s.diode) }} />
              {SOURCE_LABEL[s.id]?.[lang] ?? s.id}
            </span>
            <span className="tiny">
              {s.age_s}s · {s.records}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
