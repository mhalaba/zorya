import { useEffect, useState } from "react";
import { useStore } from "../store";
import { fmtDateTime, fmtDayTime } from "../format";
import type { FusionState, PazpZone, Signal, TrackedObject, UaThreat, UaThreatsSnapshot, VoivodeshipState } from "../types";
import { MAPAUA_URL, uaDead, uaStatusLabel, uaTypeLabel } from "../mapaua";

/**
 * Tap a voivodeship → which alerts count there and why. Tap a drone → what NEPTUN says about it,
 * plus its route from the 180-day archive. Only fields the backend actually sends are shown.
 */

const LEVEL: Record<string, { label: string; cls: string }> = {
  info: { label: "spokój", cls: "lv-info" },
  watch: { label: "uwaga", cls: "lv-watch" },
  priority: { label: "priorytet", cls: "lv-priority" },
};

const SOURCE: Record<string, { name: string; why: string; url?: string }> = {
  neptun: { name: "NEPTUN (OSINT)", why: "Obiekt śledzony nad Ukrainą w zasięgu województwa", url: "https://neptun.in.ua/" },
  ua: { name: "Alarm powietrzny w Ukrainie", why: "Aktywny alarm w przygranicznym obwodzie", url: "https://alerts.in.ua" },
  rcb: { name: "RSO / Alert RCB", why: "Komunikat o zagrożeniu z powietrza", url: "https://www.gov.pl/web/rcb" },
  rss: { name: "Media (RMF24, PAP)", why: "Doniesienie medialne o zagrożeniu z powietrza" },
  pazp: { name: "PAŻP — strefy w przestrzeni (AUP)", why: "Nowa strefa D/R/NPZ/ADHOC" },
  baltic: { name: "Kraje bałtyckie", why: "Alarm lub komunikat z krajów bałtyckich" },
  nato: { name: "NATO", why: "Komunikat NATO" },
};

const TYPE: Record<string, string> = {
  shahed: "Shahed",
  drone: "dron / BpSP",
  cruise: "pocisk manewrujący",
  ballistic: "pocisk balistyczny",
  aircraft: "samolot",
  helicopter: "śmigłowiec",
  mig31k: "MiG-31K",
  unknown: "nieznany obiekt",
};

const LOC: Record<string, string> = { track: "ślad (tor)", region: "region", locality: "miejscowość" };

const BREAKDOWN: [keyof VoivodeshipState["breakdown"], string][] = [
  ["neptun", "NEPTUN"],
  ["ua", "alarmy UA"],
  ["rcb", "RSO/RCB"],
  ["media", "media"],
  ["pazp", "PAŻP"],
  ["other", "inne"],
];

function iso(t: string | number | null | undefined): string | null {
  if (t == null || t === "") return null;
  const d = new Date(typeof t === "string" && /^\d{10,13}$/.test(t) ? Number(t) : t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function when(t: string | number | null | undefined): string {
  const i = iso(t);
  return i ? fmtDayTime(i) : "—";
}

function ago(t: string | number | null | undefined): string {
  const i = iso(t);
  if (!i) return "";
  const min = Math.round((Date.now() - new Date(i).getTime()) / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} min temu` : `${Math.floor(h / 24)} dni temu`;
}

function n(v: number | null | undefined, digits = 0): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits).replace(".", ",") : "—";
}

function compass(deg: number): string {
  const d = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return d[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function zoneActive(z: PazpZone, now = Date.now()): boolean | null {
  const a = iso(z.from);
  const b = iso(z.to);
  if (!a || !b) return null;
  return new Date(a).getTime() <= now && now < new Date(b).getTime();
}

export function MapDetail() {
  const st = useStore((s) => s.state);
  const voiv = useStore((s) => s.selectedVoiv);
  const obj = useStore((s) => s.selectedObj);
  const ua = useStore((s) => s.selectedUa);
  const uaSnap = useStore((s) => s.uaThreats);
  const close = () => useStore.getState().setSelectedVoiv(null);

  useEffect(() => {
    if (!voiv && !obj && !ua) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voiv, obj, ua]);

  if (ua) return <UaPanel snap={uaSnap} id={ua} onClose={close} />;
  if (!st || (!voiv && !obj)) return null;
  if (obj) return <ObjectPanel st={st} id={obj} onClose={close} />;
  const v = st.voivodeships.find((x) => x.id === voiv);
  if (!v) return null;
  return <VoivPanel st={st} v={v} pl={uaSnap?.enabled ? uaSnap.pl_violations : null} onClose={close} />;
}

function Shell({ title, sub, level, onClose, children }: {
  title: string;
  sub?: string;
  level?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const lv = level ? LEVEL[level] : null;
  return (
    <section className="map-detail" role="dialog" aria-label={title}>
      <div className="md-head">
        <div className="md-titles">
          <h2>{title}</h2>
          {sub && <div className="md-sub">{sub}</div>}
        </div>
        {lv && <span className={`md-level ${lv.cls}`}>{lv.label}</span>}
        <button type="button" className="md-close" onClick={onClose} aria-label="Zamknij">
          ×
        </button>
      </div>
      <div className="md-body">{children}</div>
    </section>
  );
}

function SourceLink({ source, url }: { source: string; url?: string | null }) {
  const meta = SOURCE[source];
  const name = meta?.name ?? source;
  const href = url || meta?.url;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {name}
    </a>
  ) : (
    <>{name}</>
  );
}

function VoivPanel({
  st,
  v,
  pl,
  onClose,
}: {
  st: FusionState;
  v: VoivodeshipState;
  pl: UaThreatsSnapshot["pl_violations"] | null;
  onClose: () => void;
}) {
  const signals = st.signals
    .filter((s) => s.voivodeships?.includes(v.id))
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
  const zones = (st.zones || []).filter((z) => z.voivodeships?.includes(v.id));
  const counted = BREAKDOWN.filter(([k]) => (v.breakdown?.[k] ?? 0) > 0);
  const nothing = !signals.length && !zones.length && !(v.transferred_from?.length);

  return (
    <Shell
      title={`woj. ${v.name}`}
      sub={`${n(v.points, 1)} pkt w ostatnich 60 min · stan z ${fmtDayTime(st.generated_at)}`}
      level={v.level}
      onClose={onClose}
    >
      {v.whyPl && <p className="md-why">{v.whyPl}</p>}

      {counted.length > 0 && (
        <div className="md-chips" aria-label="Skąd punkty">
          {counted.map(([k, label]) => (
            <span key={k} className="s">
              {label} {n(v.breakdown[k], 1)}
            </span>
          ))}
          {v.transfer > 0 && <span className="s">od sąsiadów {n(v.transfer, 1)}</span>}
        </div>
      )}

      {nothing ? (
        <p className="md-empty">
          Brak aktywnych alertów dla tego województwa w ostatnich 60 minutach. Żadne źródło nie zgłasza tu zagrożenia.
        </p>
      ) : (
        <>
          {signals.length > 0 && <h3 className="md-h">Aktywne alerty ({signals.length})</h3>}
          <ul className="md-list">
            {signals.map((s) => (
              <SignalItem key={s.id} s={s} st={st} />
            ))}
          </ul>

          {v.transferred_from?.length > 0 && (
            <>
              <h3 className="md-h">Przeniesione od sąsiadów</h3>
              <ul className="md-list">
                {v.transferred_from.map((t) => (
                  <li key={t.id} className="md-item">
                    <div className="md-item-top">
                      <span className="md-src">sąsiednie województwo</span>
                      <span className="md-pts">+{n(t.points, 1)} pkt</span>
                    </div>
                    <div className="md-title">woj. {t.name}</div>
                    <div className="md-meta">Sąsiad ma co najmniej 2 własne punkty, więc część trafia tutaj.</div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {zones.length > 0 && (
            <>
              <h3 className="md-h">Strefy w przestrzeni powietrznej (PAŻP)</h3>
              <ul className="md-list">
                {zones.map((z) => {
                  const act = zoneActive(z);
                  return (
                    <li key={z.id} className="md-item">
                      <div className="md-item-top">
                        <span className="md-src">PAŻP · {z.type}</span>
                        <span className={`md-state ${act === false ? "off" : "on"}`}>
                          {act === null ? "w planie AUP" : act ? "aktywna" : "nieaktywna teraz"}
                        </span>
                      </div>
                      <div className="md-title">
                        {z.type} {z.code}
                      </div>
                      <div className="md-meta">
                        {when(z.from)} – {when(z.to)} · {z.scores ? "liczy się do poziomu" : "bez punktów"}
                      </div>
                      {z.reason && <div className="md-reason">{z.reason}</div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      {pl && (
        <>
          <h3 className="md-h">Naruszenia przestrzeni PL (MAPA.UA)</h3>
          <p className={pl.count > 0 ? "md-warn" : "md-empty"}>
            {pl.count > 0
              ? `${pl.count} w ostatnich ${pl.hours} h (cała Polska, bez podziału na województwa).`
              : `Brak w ostatnich ${pl.hours} h (cała Polska).`}{" "}
            <a href={MAPAUA_URL} target="_blank" rel="noopener noreferrer">
              MAPA.UA
            </a>
            , sprawdzono {fmtDayTime(pl.checked_at)}. Nie wpływa na poziom województwa.
          </p>
        </>
      )}
      <p className="md-foot">Czasy: Europa/Warszawa. Alert liczy się przez 60 minut od ostatniej aktualizacji, z malejącą wagą.</p>
    </Shell>
  );
}

function SignalItem({ s, st }: { s: Signal; st: FusionState }) {
  const meta = SOURCE[s.source];
  const objId = s.source === "neptun" ? s.id.replace(/^sig-/, "") : null;
  const o = objId ? st.objects.find((x) => String(x.id) === objId) : null;
  const ua = s.source === "ua" ? st.ua_alerts.find((a) => `sig-ua-${a.oblast}` === s.id) : null;
  const active = ua ? ua.active : (s.weight ?? 0) > 0;
  return (
    <li className="md-item">
      <div className="md-item-top">
        <span className="md-src">
          <SourceLink source={s.source} url={s.url} />
        </span>
        <span className="md-pts">+{n(s.points, 1)} pkt</span>
      </div>
      <div className="md-title">{s.title}</div>
      <div className="md-reason">{meta?.why ?? "Sygnał źródła"}</div>
      <div className="md-meta">
        od {when(ua?.since ?? s.ts)} <span className="muted">({ago(ua?.since ?? s.ts)})</span> ·{" "}
        <span className={`md-state ${active ? "on" : "off"}`}>
          {active ? (s.weight < 1 && !ua ? `aktywny, waga ${Math.round(s.weight * 100)}%` : "aktywny") : "wygasa"}
        </span>
      </div>
      {o && (
        <button type="button" className="md-link" onClick={() => useStore.getState().setSelectedObj(String(o.id))}>
          Pokaż obiekt na mapie i jego trasę →
        </button>
      )}
    </li>
  );
}

interface ArchivedTrack {
  first_seen: number;
  last_seen: number;
  ended_at: number | null;
  points: number;
  voivodeships: string[];
  max_confidence: number | null;
  min_dist_pl_km: number | null;
  retention_days: number;
  path: { seen_at: number; lat: number; lon: number }[];
}

function ObjectPanel({ st, id, onClose }: { st: FusionState; id: string; onClose: () => void }) {
  const o = st.objects.find((x) => String(x.id) === id) as (TrackedObject & { count?: number; area_only?: boolean }) | undefined;
  const [arch, setArch] = useState<ArchivedTrack | null>(null);
  const [archMsg, setArchMsg] = useState<string>("Ładuję trasę z archiwum…");

  useEffect(() => {
    let off = false;
    setArch(null);
    setArchMsg("Ładuję trasę z archiwum…");
    const base = (useStore.getState().backendUrl || "").replace(/\/$/, "");
    fetch(`${base}/api/track/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (off) return;
        if (r.status === 404) return setArchMsg("Archiwum nie ma jeszcze tej trasy.");
        if (!r.ok) return setArchMsg("Archiwum trasy jest teraz niedostępne.");
        const t = (await r.json()) as ArchivedTrack;
        if (off) return;
        setArch(t);
        const line = (t.path || []).map((p) => [p.lon, p.lat] as [number, number]);
        useStore.getState().setObjTrack(line.length >= 2 ? line : null);
      })
      .catch(() => !off && setArchMsg("Archiwum trasy jest teraz niedostępne."));
    return () => {
      off = true;
    };
  }, [id]);

  const voivNames = (ids: string[]) =>
    ids.map((x) => st.voivodeships.find((v) => v.id === x)?.name ?? x).join(", ");

  if (!o) {
    return (
      <Shell title="Obiekt" onClose={onClose}>
        <p className="md-empty">Ten obiekt zniknął już z mapy (NEPTUN go nie śledzi).</p>
      </Shell>
    );
  }
  const contrib = (o.points_contrib || []).slice().sort((a, b) => b.points - a.points);
  // Same top regions the fusion engine attaches to this object's alert signal.
  const sig = st.signals.find((x) => x.id === `sig-${o.id}`);
  const voivFromLive = sig?.voivodeships?.length ? sig.voivodeships : contrib.slice(0, 4).map((c) => c.id);
  const voivList = voivFromLive.length ? voivFromLive : arch?.voivodeships ?? [];

  const rows: [string, React.ReactNode][] = [
    ["Typ", TYPE[o.type] ?? o.type],
    ["Opis źródła", o.title || "—"],
    ["Źródło", <SourceLink key="s" source="neptun" />],
    ["ID w NEPTUN", <code key="c">{o.id}</code>],
    ["Pozycja", `${n(o.lat, 4)}, ${n(o.lon, 4)} (±${n(o.unc_km)} km, ${LOC[o.loc_quality] ?? o.loc_quality})`],
    ["Ostatnia aktualizacja", `${when(o.ts)} (${ago(o.ts)})`],
  ];
  if (o.course != null) rows.push(["Kurs", `${n(o.course)}° (${compass(o.course)})`]);
  if (o.speed != null) rows.push(["Prędkość", `${n(o.speed)} km/h`]);
  if (o.eta_min != null) rows.push(["ETA", `${n(o.eta_min)} min`]);
  rows.push(["Pewność", `${n(o.confidence * 100)}% · potwierdzeń: ${o.confirmations}`]);
  if (o.count && o.count > 1) rows.push(["Liczba obiektów", String(o.count)]);
  rows.push(["Od granicy PL", `${n(o.dist_pl_km)} km · azymut ${n(o.azimuth_pl)}°`]);
  rows.push(["Status", o.lifecycle === "tracked" ? "śledzony" : o.lifecycle === "fading" ? "zanika (niepewny / nieaktualny)" : o.lifecycle || "—"]);
  rows.push([
    "Województwa (alert)",
    voivList.length ? voivNames(voivList) : o.observation ? "tylko obserwacja (>250 km od granicy)" : "—",
  ]);
  if (contrib.length)
    rows.push([
      "Punkty dla woj.",
      contrib
        .slice(0, 5)
        .map((c) => `${st.voivodeships.find((v) => v.id === c.id)?.name ?? c.id} +${n(c.points, 2)}`)
        .join(", ") + (contrib.length > 5 ? ` i ${contrib.length - 5} innych` : ""),
    ]);

  return (
    <Shell title={TYPE[o.type] ?? o.type} sub={`NEPTUN · ${when(o.ts)}`} onClose={onClose}>
      <dl className="md-dl">
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <h3 className="md-h">Trasa z archiwum</h3>
      {arch ? (
        <dl className="md-dl">
          <div>
            <dt>Pierwszy raz</dt>
            <dd>{fmtDateTime(new Date(arch.first_seen).toISOString())}</dd>
          </div>
          <div>
            <dt>Ostatnio</dt>
            <dd>{fmtDateTime(new Date(arch.last_seen).toISOString())}</dd>
          </div>
          <div>
            <dt>Stan śladu</dt>
            <dd>{arch.ended_at ? `zakończony ${fmtDateTime(new Date(arch.ended_at).toISOString())}` : "trwa"}</dd>
          </div>
          <div>
            <dt>Punkty trasy</dt>
            <dd>
              {arch.path.length}
              {arch.path.length >= 2 ? " · trasa podświetlona na mapie" : " · za mało punktów, by narysować trasę"}
            </dd>
          </div>
          {arch.min_dist_pl_km != null && (
            <div>
              <dt>Najbliżej PL</dt>
              <dd>{n(arch.min_dist_pl_km)} km</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="md-empty">{archMsg}</p>
      )}
      <p className="md-foot">NEPTUN to OSINT, nie radar. Czasy: Europa/Warszawa.</p>
    </Shell>
  );
}

function UaPanel({ snap, id, onClose }: { snap: UaThreatsSnapshot | null; id: string; onClose: () => void }) {
  const o: UaThreat | undefined = snap?.objects.find((x) => x.id === id);
  if (!o) {
    return (
      <Shell title="MAPA.UA" onClose={onClose}>
        <p className="md-empty">Tego obiektu nie ma już w danych MAPA.UA (brak aktualizacji od ponad 60 minut).</p>
      </Shell>
    );
  }
  const dead = uaDead(o);
  const from = o.from_name || o.from_zone;
  const to = o.to_name || o.to_city;
  const rows: [string, React.ReactNode][] = [["Typ", uaTypeLabel(o)]];
  if (o.amount > 1) rows.push(["Liczba", String(o.amount)]);
  if (from || to) rows.push(["Skąd → dokąd", `${from ?? "?"} → ${to ?? "?"}`]);
  rows.push(["Status", uaStatusLabel(o.status)]);
  if (o.speed_kmh != null) rows.push(["Prędkość", `${n(o.speed_kmh)} km/h (szacunek)`]);
  if (o.heading != null) rows.push(["Kurs", `${n(o.heading)}° (${compass(o.heading)})`]);
  rows.push(["Pozycja", `${n(o.lat, 4)}, ${n(o.lon, 4)}`]);
  if (o.predicted && !dead) rows.push(["Przewidywana", `${n(o.predicted[1], 4)}, ${n(o.predicted[0], 4)} (linia przerywana)`]);
  if (o.first_seen) rows.push(["Pierwszy raz", `${fmtDateTime(new Date(o.first_seen).toISOString())}`]);
  rows.push(["Ostatnio", `${fmtDateTime(new Date(o.last_seen).toISOString())} (${ago(o.last_seen)})`]);
  if (o.title) rows.push(["Komunikat", o.title]);
  rows.push([
    "Źródło",
    <a key="s" href={MAPAUA_URL} target="_blank" rel="noopener noreferrer">
      MAPA.UA
    </a>,
  ]);
  return (
    <Shell title={uaTypeLabel(o)} sub={`MAPA.UA · ${when(o.last_seen)}${dead ? " · " + uaStatusLabel(o.status) : ""}`} onClose={onClose}>
      <dl className="md-dl">
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <p className="md-foot">
        Szacunkowe pozycje z komunikatów, to nie jest oficjalne ostrzeżenie. {snap?.ok === false ? "MAPA.UA nie odpowiada, dane mogą być nieaktualne. " : ""}
        Czasy: Europa/Warszawa.
      </p>
    </Shell>
  );
}
