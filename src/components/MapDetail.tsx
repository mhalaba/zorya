import { useEffect, useState } from "react";
import { useStore } from "../store";
import { fmtDateTime, fmtDayTime } from "../format";
import type {
  AirspaceSnapshot,
  AirspaceZone,
  FusionState,
  LocalAlert,
  LocalAlertsSnapshot,
  LocalCategory,
  Notam,
  PlaceInfo,
  PazpZone,
  Signal,
  TrackedObject,
  UaThreat,
  UaThreatsSnapshot,
  VoivodeshipState,
} from "../types";
import { MAPAUA_URL, NEPTUN_URL, uaDead, uaSourceLabel, uaStatusLabel, uaTypeLabel } from "../mapaua";
import { azimuthDeg, haversineKm } from "../lib";
import { powiatLevels } from "../admin";
import {
  geometrySourceLabel,
  LOCAL_META,
  LOCAL_ORDER,
  localKindLabel,
  localStateLabel,
  localWindow,
  NOTAM_META,
  notamLimits,
  notamWindow,
  visibleLocal,
} from "../overlays";

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
  const notamSel = useStore((s) => s.selectedNotams);
  const listPanel = useStore((s) => s.listPanel);
  const air = useStore((s) => s.airspace);
  const local = useStore((s) => s.localAlerts);
  const gmina = useStore((s) => s.selectedGmina);
  const close = () => useStore.getState().setSelectedVoiv(null);
  const open = !!(voiv || obj || ua || notamSel || listPanel || gmina);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (listPanel === "notam") return <NotamListPanel air={air} st={st} onClose={close} />;
  if (listPanel === "local") return <LocalListPanel snap={local} st={st} onClose={close} />;
  if (notamSel) return <AreasPanel air={air} st={st} keys={notamSel} onClose={close} />;
  if (ua) return <UaPanel snap={uaSnap} id={ua} onClose={close} />;
  if (gmina) return <GminaPanel key={gmina.gmina.id} place={gmina} st={st} ua={uaSnap} air={air} local={local} onClose={close} />;
  if (!st || (!voiv && !obj)) return null;
  if (obj) return <ObjectPanel st={st} id={obj} onClose={close} />;
  const v = st.voivodeships.find((x) => x.id === voiv);
  if (!v) return null;
  return <VoivPanel st={st} v={v} pl={uaSnap?.enabled ? uaSnap.pl_violations : null} air={air} local={local} onClose={close} />;
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
  air,
  local,
  onClose,
}: {
  st: FusionState;
  v: VoivodeshipState;
  pl: UaThreatsSnapshot["pl_violations"] | null;
  air: AirspaceSnapshot | null;
  local: LocalAlertsSnapshot | null;
  onClose: () => void;
}) {
  const localCats = useStore((s) => s.localCats);
  const localHere = visibleLocal(local, localCats).filter((a) => a.voivodeships.includes(v.id));
  const notamsHere = (air?.notam.items ?? []).filter((n) => n.voivodeships.includes(v.id));
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
          Brak zagrożeń z powietrza dla tego województwa w ostatnich 60 minutach. Żadne źródło nie zgłasza tu zagrożenia.
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
      <h3 className="md-h">Lokalne: awarie, wyłączenia, ćwiczenia ({localHere.length})</h3>
      {localHere.length ? (
        <ul className="md-list">
          {localHere.map((a) => (
            <LocalCard key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <p className="md-empty">
          {local ? "Brak komunikatów RSO o awariach lub wyłączeniach wody, prądu, gazu ani o ćwiczeniach." : "Ładuję komunikaty lokalne…"}
        </p>
      )}

      <h3 className="md-h">NOTAM i strefy AUP nad województwem ({notamsHere.length})</h3>
      {notamsHere.length ? (
        <ul className="md-list">
          {notamsHere.map((n) => (
            <NotamCard key={`${n.location}:${n.id}`} n={n} st={st} compact />
          ))}
        </ul>
      ) : (
        <p className="md-empty">
          {!air ? "Ładuję NOTAM…" : air.notam.ok ? "Brak NOTAM ani rezerwacji AUP z obszarem nad tym województwem." : `NOTAM niedostępne (${air.notam.error ?? "?"}).`}
        </p>
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
      <Shell title="Nad Ukrainą" onClose={onClose}>
        <p className="md-empty">Tego obiektu nie ma już na mapie (brak aktualizacji od ponad 60 minut).</p>
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
  const own = !o.source || o.source === "own";
  rows.push([
    "Źródło",
    own ? (
      uaSourceLabel(o.source)
    ) : (
      <a key="s" href={o.source === "neptun" ? NEPTUN_URL : MAPAUA_URL} target="_blank" rel="noopener noreferrer">
        {uaSourceLabel(o.source)}
      </a>
    ),
  ]);
  if (own && o.confidence != null) rows.push(["Pewność", `${Math.round(o.confidence * 100)}% (${o.channels?.length ?? 0} kan.)`]);
  const srcShort = own ? "Zorya" : o.source === "neptun" ? "NEPTUN" : "MAPA.UA";
  return (
    <Shell title={uaTypeLabel(o)} sub={`${srcShort} · ${when(o.last_seen)}${dead ? " · " + uaStatusLabel(o.status) : ""}`} onClose={onClose}>
      <dl className="md-dl">
        {rows.map(([k, val]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      {own && (o.reports?.length ?? 0) > 0 && (
        <>
          <h3 className="md-h">Komunikaty źródłowe (kanały Telegram)</h3>
          <ul className="md-list ua-reports">
            {[...(o.reports ?? [])].reverse().map((r) => (
              <li key={`${r.url}-${r.text}`} className="md-item">
                <div className="md-meta">
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    @{r.channel}
                  </a>{" "}
                  · {fmtDateTime(new Date(r.ts).toISOString())}
                </div>
                <div className="md-title">{r.text}</div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="md-foot">
        Szacunkowe pozycje z komunikatów, to nie jest oficjalne ostrzeżenie. {snap?.ok === false ? "Źródła nie odpowiadają, dane mogą być nieaktualne. " : ""}
        Czasy: Europa/Warszawa.
      </p>
    </Shell>
  );
}

// ---- airspace & local alerts ---------------------------------------------------------------------

function voivNames(st: FusionState | null, ids: string[]): string {
  return ids.map((x) => st?.voivodeships.find((v) => v.id === x)?.name ?? x).join(", ");
}

function NotamCard({ n, st, compact = false }: { n: Notam; st: FusionState | null; compact?: boolean }) {
  const meta = NOTAM_META[n.category];
  const focusOn = useStore((s) => s.focusOn);
  const active = n.state === "active";
  const lim = notamLimits(n);
  return (
    <li className="md-item ov-item" style={{ borderLeftColor: meta?.color }}>
      <div className="md-item-top">
        <span className="md-src">
          {n.geometry_source === "aup" ? "PAŻP AUP/UUP" : "NOTAM"} <b>{n.id}</b>
          {n.location ? ` · ${n.location}` : ""}
        </span>
        <span className={`md-state ${active ? "on" : "off"}`}>{active ? (n.geometry_source === "aup" ? "zarezerwowana" : "obowiązuje") : n.geometry_source === "aup" ? "zaplanowana" : "zapowiedziany"}</span>
      </div>
      <div className="md-title">
        {n.label}
        {n.condition_label ? ` — ${n.condition_label}` : ""}
      </div>
      <div className="md-meta">
        {notamWindow(n)}
        {n.schedule ? ` · harmonogram: ${n.schedule}` : ""}
      </div>
      {(lim || !compact) && (
        <div className="md-meta">
          {lim ? `Wysokość ${lim}` : ""}
          {!compact ? `${lim ? " · " : ""}${geometrySourceLabel(n.geometry_source)}` : ""}
        </div>
      )}
      {!compact && n.voivodeships.length > 0 && <div className="md-meta">Województwa: {voivNames(st, n.voivodeships)}</div>}
      {compact ? (
        <details className="ov-more">
          <summary>Treść</summary>
          <pre className="notam-text">{n.text || n.raw}</pre>
        </details>
      ) : (
        <>
          <pre className="notam-text">{n.text || n.raw}</pre>
          {n.raw && n.raw !== n.text && (
            <details className="ov-more">
              <summary>Pełny komunikat (ICAO)</summary>
              <pre className="notam-text">{n.raw}</pre>
            </details>
          )}
        </>
      )}
      {n.bbox && n.map && (
        <button type="button" className="md-link" onClick={() => focusOn(n.bbox!)}>
          Pokaż obszar na mapie →
        </button>
      )}
    </li>
  );
}

function ZoneCard({ z, st }: { z: AirspaceZone; st: FusionState | null }) {
  const lim = notamLimits(z);
  return (
    <li className="md-item ov-item" style={{ borderLeftColor: z.kind === "danger" ? "#F0783A" : z.kind === "reserved" ? "#E0A100" : "#FF5A4E" }}>
      <div className="md-item-top">
        <span className="md-src">Strefa stała · {z.code}</span>
        <span className="md-state off">{z.by_notam ? "aktywowana NOTAM-em" : "wg AIP/AUP"}</span>
      </div>
      <div className="md-title">{z.name}</div>
      <div className="md-meta">
        {z.label}
        {lim ? ` · wysokość ${lim}` : ""}
      </div>
      {z.voivodeships.length > 0 && <div className="md-meta">Województwa: {voivNames(st, z.voivodeships)}</div>}
      <div className="md-reason">Granice strefy stałej. Czy jest aktywna teraz, mówi NOTAM lub plan AUP — nie ta warstwa.</div>
    </li>
  );
}

/** Everything under a tapped point: NOTAM areas and permanent areas. */
function AreasPanel({ air, st, keys, onClose }: { air: AirspaceSnapshot | null; st: FusionState | null; keys: string[]; onClose: () => void }) {
  const notams = (air?.notam.items ?? []).filter((n) => keys.includes(`notam:${n.location}:${n.id}`));
  const zones = (air?.zones.items ?? []).filter((z) => keys.includes(`zone:${z.id}`));
  const total = notams.length + zones.length;
  const at = notams[0]?.voivodeships[0] ?? zones[0]?.voivodeships[0];
  return (
    <Shell
      title={total === 1 && notams.length ? `${notams[0].geometry_source === "aup" ? "AUP" : "NOTAM"} ${notams[0].id}` : `Strefy w tym miejscu (${total})`}
      sub={air?.notam.fetched_at ? `NOTAM pobrane ${fmtDayTime(air.notam.fetched_at)}` : undefined}
      onClose={onClose}
    >
      {!total && <p className="md-empty">Tej strefy nie ma już w danych (NOTAM wygasł lub został odwołany).</p>}
      <ul className="md-list">
        {notams.map((n) => (
          <NotamCard key={`${n.location}:${n.id}`} n={n} st={st} />
        ))}
        {zones.map((z) => (
          <ZoneCard key={z.id} z={z} st={st} />
        ))}
      </ul>
      {at && (
        <button type="button" className="md-link" onClick={() => useStore.getState().setSelectedVoiv(at)}>
          Pokaż województwo {voivNames(st, [at])} →
        </button>
      )}
      <NotamFoot air={air} />
    </Shell>
  );
}

function NotamFoot({ air }: { air: AirspaceSnapshot | null }) {
  return (
    <p className="md-foot">
      Źródło: {air?.notam.source ?? "FAA NOTAM Search"} (FIR {air?.notam.locations.join(", ") || "EPWW"})
      {air?.notam.fetched_at ? `, pobrano ${fmtDayTime(air.notam.fetched_at)}` : ""}
      {air && !air.notam.ok && air.notam.enabled ? ` — brak świeżych danych: ${air.notam.error}` : ""}.
      {air?.notam.skipped ? ` Pominięto ${air.notam.skipped} NOTAM o przeszkodach, oświetleniu i lotniskach.` : ""}
      {air?.notam.truncated ? " Źródło ma więcej NOTAM, niż zostało odczytane — lista może być niepełna." : ""}
      {air?.notam.aup?.enabled ? " AUP/UUP: plan użycia przestrzeni (rezerwacje TSA/TRA/D/R na dziś i jutro) z airspace.pansa.pl." : ""}
      {air?.zones.enabled ? ` Strefy stałe: ${air.zones.source}.` : ""} Czasy: Europa/Warszawa. Do planowania lotu używaj
      oficjalnego briefingu (AIS PAŻP), nie tej mapy.
    </p>
  );
}

function NotamListPanel({ air, st, onClose }: { air: AirspaceSnapshot | null; st: FusionState | null; onClose: () => void }) {
  const [onlyMap, setOnlyMap] = useState(true);
  const [onlyNow, setOnlyNow] = useState(false);
  const all = air?.notam.items ?? [];
  const list = all.filter((n) => (!onlyMap || n.map) && (!onlyNow || n.state === "active"));
  const zones = air?.zones.enabled ? air.zones.items : [];
  return (
    <Shell title="NOTAM i AUP/UUP — przestrzeń powietrzna" sub={`${all.length} pozycji · ${all.filter((n) => n.map).length} z obszarem na mapie`} onClose={onClose}>
      {!air && <p className="md-empty">Ładuję NOTAM…</p>}
      {air && !air.notam.enabled && <p className="md-empty">Warstwa NOTAM jest wyłączona na tym serwerze.</p>}
      {air?.notam.enabled && (
        <>
          <div className="ov-filters" role="group" aria-label="Filtr NOTAM">
            <button type="button" className={`ov-chip ${onlyMap ? "on" : ""}`} aria-pressed={onlyMap} onClick={() => setOnlyMap((x) => !x)}>
              tylko strefy na mapie
            </button>
            <button type="button" className={`ov-chip ${onlyNow ? "on" : ""}`} aria-pressed={onlyNow} onClick={() => setOnlyNow((x) => !x)}>
              tylko obowiązujące teraz
            </button>
          </div>
          <div className="ov-legend" aria-label="Legenda">
            <span><i className="lg-solid" /> obowiązuje</span>
            <span><i className="lg-dash" /> zapowiedziany lub obszar przybliżony</span>
          </div>
          {list.length ? (
            <ul className="md-list">
              {list.map((n) => (
                <NotamCard key={`${n.location}:${n.id}`} n={n} st={st} compact />
              ))}
            </ul>
          ) : (
            <p className="md-empty">{air.notam.ok || all.length ? "Brak NOTAM spełniających filtr." : `Brak danych NOTAM (${air.notam.error ?? "?"}).`}</p>
          )}
        </>
      )}
      {zones.length > 0 && (
        <p className="md-reason">Strefy stałe (P/R/D/TSA/TRA, {zones.length}) są na mapie jako przerywane kontury — dotknij strefy, by zobaczyć szczegóły.</p>
      )}
      <NotamFoot air={air} />
    </Shell>
  );
}

/** Where the source places the alert, in words — never more precise than the source. */
function precisionLabel(a: LocalAlert): string {
  if (a.precision === "point") return "Miejsce: punkt podany przez operatora";
  const g = a.gminy?.length ?? 0;
  const p = a.powiaty?.length ?? 0;
  if (g) return g === 1 ? "Miejsce: jedna gmina" : `Miejsce: ${g} gmin(y)`;
  if (p) return p === 1 ? "Dotyczy całego powiatu" : `Dotyczy ${p} powiatów`;
  return "";
}

function LocalCard({ a }: { a: LocalAlert }) {
  return (
    <li className="md-item ov-item" style={{ borderLeftColor: LOCAL_META[a.category].color }}>
      <div className="md-item-top">
        <span className="md-src">
          {a.categories.map((c) => LOCAL_META[c].label).join(" + ")} · {localKindLabel(a)}
        </span>
        <span className={`md-state ${a.state === "active" ? "on" : "off"}`}>{localStateLabel(a)}</span>
      </div>
      <div className="md-title">{a.title}</div>
      {a.summary && <div className="md-reason">{a.summary}</div>}
      {a.precision && a.precision !== "voivodeship" && <div className="md-meta">{precisionLabel(a)}</div>}
      <div className="md-meta">
        {localWindow(a)} · {a.source_name}
        {a.url && (
          <>
            {" · "}
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              treść komunikatu
            </a>
          </>
        )}
      </div>
    </li>
  );
}

function LocalListPanel({ snap, st, onClose }: { snap: LocalAlertsSnapshot | null; st: FusionState | null; onClose: () => void }) {
  const cats = useStore((s) => s.localCats);
  const setCat = useStore((s) => s.setLocalCat);
  const list = visibleLocal(snap, cats);
  const groups = new Map<string, LocalAlert[]>();
  for (const a of list) {
    const keys = a.voivodeships.length ? a.voivodeships : [""];
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), a]);
  }
  const order = [...groups.keys()].sort((x, y) => (x === "" ? 1 : y === "" ? -1 : voivNames(st, [x]).localeCompare(voivNames(st, [y]), "pl")));
  const all = (snap?.items ?? []).filter((a) => a.state !== "ended");
  const count = (c: LocalCategory) => all.filter((a) => a.categories.includes(c)).length;
  const rso = snap?.sources.find((x) => x.id === "rso");
  return (
    <Shell title="Lokalne: awarie, wyłączenia, ćwiczenia, ostrzeżenia IMGW" sub={`${list.length} komunikatów · ${list.filter((a) => a.state === "active").length} trwa`} onClose={onClose}>
      <div className="ov-filters" role="group" aria-label="Rodzaj">
        {LOCAL_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            className={`ov-chip ${cats[c] ? "on" : ""}`}
            aria-pressed={cats[c]}
            onClick={() => setCat(c, !cats[c])}
          >
            <span className="mq-dot" style={{ background: LOCAL_META[c].color }} aria-hidden="true" /> {LOCAL_META[c].short} {count(c)}
          </button>
        ))}
      </div>
      {!snap && <p className="md-empty">Ładuję komunikaty…</p>}
      {snap && !list.length && <p className="md-empty">Brak bieżących ani zaplanowanych komunikatów o awariach wody, prądu, gazu, o ćwiczeniach ani ostrzeżeń IMGW.</p>}
      {order.map((k) => (
        <section key={k || "pl"}>
          <h3 className="md-h">
            {k ? (
              <button type="button" className="md-link" onClick={() => useStore.getState().setSelectedVoiv(k)}>
                woj. {voivNames(st, [k])}
              </button>
            ) : (
              "Bez przypisanego województwa"
            )}{" "}
            ({groups.get(k)!.length})
          </h3>
          <ul className="md-list">
            {groups.get(k)!.map((a) => (
              <LocalCard key={`${k}:${a.id}`} a={a} />
            ))}
          </ul>
        </section>
      ))}
      <p className="md-foot">
        Źródło: komunikaty RSO (komunikaty.tvp.pl) wybrane automatycznie po treści
        {rso && !rso.ok ? ` — RSO teraz nie odpowiada (${rso.error ?? "?"}), lista z ostatniego pobrania` : ""}
        {(snap?.sources.length ?? 0) > 1 ? `, oraz ${snap!.sources.filter((x) => x.id !== "rso").map((x) => x.name ?? x.id).join(", ")}` : ""}. Okno czasowe
        odczytane z treści (operatorzy i IMGW podają je wprost); „komunikat z …” = bez daty w treści. Ostrzeżenia IMGW są
        informacyjne i nie wpływają na poziom zagrożenia powietrznego. Szczegóły zawsze w oryginale. Czasy: Europa/Warszawa.
      </p>
    </Shell>
  );
}

// ---- gmina ---------------------------------------------------------------------------------------

const LEVEL_TEXT: Record<string, string> = { info: "spokój", watch: "uwaga", priority: "priorytet" };

interface Near {
  key: string;
  label: string;
  km: number;
  bearing: number;
  toward: boolean;
  eta: number | null;
  unc: number | null;
  source: string;
  dead?: boolean;
  open: () => void;
}

/** Bearing difference in degrees, 0–180. */
const angle = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Threats around a gmina's anchor: NEPTUN objects and MAPA.UA objects, nearest first. */
function threatsNear(anchor: [number, number], st: FusionState | null, ua: UaThreatsSnapshot | null, maxKm = 400): Near[] {
  const [lon, lat] = anchor;
  const out: Near[] = [];
  const add = (id: string, label: string, olat: number, olon: number, course: number | null, speed: number | null, unc: number | null, source: string, open: () => void, dead = false) => {
    const km = haversineKm(lat, lon, olat, olon);
    if (km > maxKm) return;
    const bearing = (azimuthDeg(lat, lon, olat, olon) + 360) % 360;
    // Heading at the gmina: the object's course within 30° of the bearing from the object to the gmina.
    const back = (azimuthDeg(olat, olon, lat, lon) + 360) % 360;
    const toward = course != null && !dead && angle(course, back) <= 30;
    const eta = toward && speed && speed > 30 ? Math.round((km / speed) * 60) : null;
    out.push({ key: id, label, km, bearing, toward, eta, unc, source, dead, open });
  };
  for (const o of st?.objects ?? []) {
    add(`n:${o.id}`, TYPE[o.type] ?? o.type, o.lat, o.lon, o.course, o.speed, o.unc_km, "NEPTUN", () => useStore.getState().setSelectedObj(String(o.id)));
  }
  for (const o of ua?.enabled ? ua.objects : []) {
    add(`u:${o.id}`, uaTypeLabel(o), o.lat, o.lon, o.heading, o.speed_kmh, null, !o.source || o.source === "own" ? "Zorya (UA)" : o.source === "neptun" ? "NEPTUN" : "MAPA.UA", () => useStore.getState().setSelectedUa(o.id), uaDead(o));
  }
  return out.sort((a, b) => Number(b.toward) - Number(a.toward) || a.km - b.km).slice(0, 8);
}

function GminaPanel({
  place,
  st,
  ua,
  air,
  local,
  onClose,
}: {
  place: PlaceInfo;
  st: FusionState | null;
  ua: UaThreatsSnapshot | null;
  air: AirspaceSnapshot | null;
  local: LocalAlertsSnapshot | null;
  onClose: () => void;
}) {
  const g = place.gmina;
  const cats = useStore((s) => s.localCats);
  const focusOn = useStore((s) => s.focusOn);
  const voiv = st?.voivodeships.find((v) => v.id === g.voivodeship);
  const pow = powiatLevels(st).get(g.powiat.id);
  const level = pow?.level ?? "info";
  const near = threatsNear(g.anchor, st, ua);

  const alerts = visibleLocal(local, cats);
  // Applies here: named for this gmina, or for its whole powiat (an IMGW warning lists powiaty, not gminy).
  const inGmina = alerts.filter((a) => a.gminy?.includes(g.id) || (!a.gminy?.length && a.powiaty?.includes(g.powiat.id)));
  // Nearby: other gminy of the same powiat.
  const inPowiat = alerts.filter((a) => a.gminy?.length && !a.gminy.includes(g.id) && a.powiaty?.includes(g.powiat.id));
  const inVoiv = alerts.filter((a) => !(a.gminy?.length) && !(a.powiaty?.length) && a.voivodeships.includes(g.voivodeship));
  const zones = (air?.notam.items ?? []).filter((n) => n.gminy?.includes(g.id));
  const tapAreas = useStore((s) => s.tapAreas);

  return (
    <Shell
      title={g.name}
      sub={`gmina ${g.kind} · ${g.powiat.label} · woj. ${voiv?.name ?? g.voivodeship}`}
      level={level}
      onClose={onClose}
    >
      <p className="md-why">
        {pow ? (
          <>
            {g.powiat.label.charAt(0).toUpperCase() + g.powiat.label.slice(1)}: <b>{LEVEL_TEXT[pow.level]}</b> ({n(pow.points, 1)} pkt)
            {pow.whyPl ? ` — ${pow.whyPl}` : ""}.
          </>
        ) : (
          <>
            {g.powiat.label.charAt(0).toUpperCase() + g.powiat.label.slice(1)}: spokój — żadne źródło nie daje tu punktów w ostatnich 60
            minutach.
          </>
        )}
        {voiv && (
          <>
            {" "}
            Województwo jako całość: {LEVEL_TEXT[voiv.level]} ({n(voiv.points, 1)} pkt).
          </>
        )}
      </p>
      <WatchGmina id={g.id} name={g.name} />
      <div className="md-chips">
        <button type="button" className="ov-chip" onClick={() => focusOn(g.bbox)}>
          pokaż gminę
        </button>
        <button type="button" className="ov-chip" onClick={() => place.powiat && focusOn(place.powiat.bbox)}>
          pokaż powiat
        </button>
        <button type="button" className="ov-chip" onClick={() => useStore.getState().setSelectedVoiv(g.voivodeship)}>
          województwo
        </button>
      </div>

      <h3 className="md-h">Zagrożenia w promieniu 400 km ({near.length})</h3>
      {near.length ? (
        <ul className="md-list">
          {near.map((x) => (
            <li key={x.key} className="md-item">
              <div className="md-item-top">
                <span className="md-src">{x.source}</span>
                <span className={`md-state ${x.toward ? "on" : "off"}`}>{x.dead ? "zestrzelony / utracony" : x.toward ? "kurs w stronę gminy" : "inny kurs"}</span>
              </div>
              <div className="md-title">{x.label}</div>
              <div className="md-meta">
                {n(x.km)} km na {compass(x.bearing)} od gminy
                {x.unc ? ` (±${n(x.unc)} km)` : ""}
                {x.eta != null ? ` · przy obecnym kursie ok. ${x.eta} min` : ""}
              </div>
              <button type="button" className="md-link" onClick={x.open}>
                Szczegóły obiektu →
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="md-empty">Żaden śledzony obiekt nie jest bliżej niż 400 km od tej gminy.</p>
      )}

      <h3 className="md-h">Dotyczy tej gminy ({inGmina.length})</h3>
      {inGmina.length ? (
        <ul className="md-list">
          {inGmina.map((a) => (
            <LocalCard key={a.id} a={a} />
          ))}
        </ul>
      ) : (
        <p className="md-empty">Brak komunikatów przypisanych do tej gminy (awarie, wyłączenia, ćwiczenia).</p>
      )}
      {inPowiat.length > 0 && (
        <>
          <h3 className="md-h">W innych gminach powiatu ({inPowiat.length})</h3>
          <ul className="md-list">
            {inPowiat.map((a) => (
              <LocalCard key={a.id} a={a} />
            ))}
          </ul>
        </>
      )}
      {inVoiv.length > 0 && (
        <details className="ov-more">
          <summary>W województwie, bez dokładnego miejsca ({inVoiv.length})</summary>
          <ul className="md-list">
            {inVoiv.map((a) => (
              <LocalCard key={a.id} a={a} />
            ))}
          </ul>
        </details>
      )}

      {tapAreas && (
        <button type="button" className="md-link" onClick={() => useStore.getState().setSelectedNotams(tapAreas)}>
          Strefy w miejscu dotknięcia ({tapAreas.length}) →
        </button>
      )}
      <h3 className="md-h">Przestrzeń powietrzna nad gminą ({zones.length})</h3>
      {zones.length ? (
        <ul className="md-list">
          {zones.map((z) => (
            <NotamCard key={`${z.location}:${z.id}`} n={z} st={st} compact />
          ))}
        </ul>
      ) : (
        <p className="md-empty">{air ? "Żadna strefa z planu AUP/UUP ani NOTAM nie obejmuje tej gminy." : "Ładuję strefy…"}</p>
      )}
      <p className="md-foot">
        Granice gmin: PRG (Geoportal, 2025), uproszczone — przy samej granicy gminy wynik może dotyczyć sąsiedniej. Odległości od
        środka gminy; pozycje NEPTUN, MAPA.UA i własnego silnika Zorya są szacunkowe. Czasy: Europa/Warszawa.
      </p>
    </Shell>
  );
}

/** Push for this gmina: asks for permission once, then subscribes (notifications follow the powiat's level). */
function WatchGmina({ id, name }: { id: string; name: string }) {
  const watching = useStore((s) => s.watchGminy.some((x) => x.id === id));
  const [msg, setMsg] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  async function toggle() {
    const st = useStore.getState();
    if (!watching) {
      if (!supported) return setMsg("Ta przeglądarka nie obsługuje powiadomień push (na iPhonie: dodaj Zoryę do ekranu początkowego).");
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") return setMsg("Bez zgody na powiadomienia nie da się obserwować gminy.");
      // Watching a gmina is its own opt-in: it does not switch on notifications for other areas.
      const areas = st.areas.filter((a) => /^[a-z]+(?:-[a-z]+)?$/.test(a.area.id)).length;
      if (st.watchGminy.length + (st.notifyGranted ? areas : 0) >= 8) return setMsg("Można obserwować najwyżej 8 miejsc — usuń któreś.");
    }
    st.toggleWatchGmina({ id, name });
    setMsg(watching ? "Nie obserwujesz już tej gminy." : "Obserwujesz tę gminę: powiadomimy, gdy jej powiat osiągnie poziom uwagi lub priorytetu.");
  }
  return (
    <div className="md-watch">
      <button type="button" className={`ov-chip ${watching ? "on" : ""}`} aria-pressed={watching} onClick={() => void toggle()}>
        {watching ? "✓ obserwujesz tę gminę" : "🔔 powiadamiaj o tej gminie"}
      </button>
      {msg && <div className="md-meta">{msg}</div>}
    </div>
  );
}
