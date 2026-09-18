import {
  Bell,
  BookOpen,
  Coffee,
  Crosshair,
  Download,
  Layers,
  Map as MapIcon,
  Radio,
  Settings,
  UserRound,
  Box,
  BoxSelect,
} from "lucide-react";
import { StarMark } from "./StarMark";
import { useStore } from "../store";
import { t } from "../i18n";
import { SOURCE_LABEL, SUPPORT_URL, GUIDE_URL, EAST_IDS } from "../config";
import { ageSeconds, ageLabel, diodeColor, fmtPts, strongestSource } from "../lib";
import { syncPushSubscription } from "../push";
import type { FusionState, Level, SourceStatus } from "../types";

function maxLevel(state: FusionState | null): Level {
  if (!state) return "info";
  if (state.voivodeships.some((v) => v.level === "priority")) return "priority";
  if (state.voivodeships.some((v) => v.level === "watch")) return "watch";
  return "info";
}

export function TopBar({ onInstall }: { onInstall: () => void }) {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const connecting = useStore((s) => s.connecting);
  const setLang = useStore((s) => s.setLang);
  const setDrawer = useStore((s) => s.setDrawer);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const notifyOn = useStore((s) => s.notifyOn);
  const level = maxLevel(state);

  return (
    <header className="topbar">
      <div className="brand">
        <StarMark level={level} />
        <div className="brand-type">
          <div className="brand-name">Zorya</div>
          <div className="brand-sub">{t(lang, "tagline")}</div>
        </div>
      </div>
      <div className="diodes" role="list" aria-label={t(lang, "sourceStatus")}>
        {connecting && !state ? (
          <div className="skeleton" aria-label={t(lang, "connecting")}>
            <span className="sk" />
            <span className="sk" />
            <span className="sk" />
            <span className="tiny">{t(lang, "connecting")}</span>
          </div>
        ) : (
          (state?.sources ?? []).map((src) => <Diode key={src.id} src={src} lang={lang} onOpen={() => setDrawer({ kind: "source", id: src.id })} />)
        )}
        {state?.demo && <span className="pill">{t(lang, "demo")}</span>}
      </div>
      <div className="actions">
        <button className="text-btn cta-green hide-sm" onClick={onInstall}>
          <Download size={16} /> {t(lang, "download")}
        </button>
        <a className="text-btn hide-sm" href={GUIDE_URL} target="_blank" rel="noreferrer">
          <BookOpen size={16} /> {t(lang, "instruction")}
        </a>
        <a className="text-btn cta-amber hide-sm" href={SUPPORT_URL} target="_blank" rel="noreferrer">
          <Coffee size={16} /> {t(lang, "support")}
        </a>
        <button className="icon-btn" onClick={() => setLang(lang === "pl" ? "en" : "pl")} aria-label="PL/EN">
          {lang === "pl" ? "EN" : "PL"}
        </button>
        <button className="icon-btn" onClick={() => void enableNotify()} aria-label={t(lang, "bell")} title={t(lang, "bell")}>
          <Bell size={18} color={notifyOn ? "#E0A100" : undefined} />
        </button>
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label={t(lang, "settings")}>
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}

function Diode({ src, lang, onOpen }: { src: SourceStatus; lang: "pl" | "en"; onOpen: () => void }) {
  const label = SOURCE_LABEL[src.id]?.[lang] ?? src.id;
  return (
    <button className="diode" role="listitem" onClick={onOpen} title={`${label}: ${src.message}`}>
      <span className={`dot ${src.diode} ${src.diode === "ok" ? "pulse" : ""}`} style={{ background: diodeColor(src.diode) }} />
      <span className="hide-sm">{label}</span>
    </button>
  );
}

async function enableNotify() {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  useStore.setState({ notifyOn: perm === "granted" });
  await syncPushSubscription();
}

export function Ticker({ now }: { now: number }) {
  const lang = useStore((s) => s.lang);
  const live = useStore((s) => s.state);
  const historyMode = useStore((s) => s.historyMode);
  const history = useStore((s) => s.history);
  const historyIdx = useStore((s) => s.historyIdx);
  const connecting = useStore((s) => s.connecting);

  const painted = live?.voivodeships ?? [];
  const histPts = historyMode && history ? painted.map((v) => ({ ...v, points: history.voivodeships[v.id]?.[historyIdx] ?? 0 })) : painted;
  const top = [...histPts].sort((a, b) => b.points - a.points || a.eastRank - b.eastRank)[0];
  const age = live ? ageSeconds(live.generated_at, now) : 0;
  const calm = !top || top.points < 2;

  if (connecting && !live) {
    return <div className="ticker panel panel-ornament calm">{t(lang, "connecting")}</div>;
  }
  if (calm) {
    return <div className="ticker panel panel-ornament calm">{t(lang, "tickerCalm")}</div>;
  }
  const lvl = top.points >= 4 ? "priority" : "watch";
  const name = lang === "en" ? top.nameEn : top.name;
  const why = lang === "en" ? top.whyEn : top.whyPl;
  return (
    <div className="ticker panel panel-ornament">
      <span>
        {t(lang, "tickerNow")}: {name}{" "}
        <strong className="tabular">
          {fmtPts(top.points, lang)} {t(lang, "pts")}
        </strong>{" "}
        · <span className={lvl === "priority" ? "lvl-priority" : "lvl-watch"}>{lvl === "priority" ? t(lang, "levelPriority") : t(lang, "levelWatch")}</span>
        {why ? ` — ${why}` : ` · ${strongestSource(top.breakdown)}`} · {t(lang, "update")} {age}s {t(lang, "ago")}
      </span>
    </div>
  );
}

export function DisclaimerLine() {
  const lang = useStore((s) => s.lang);
  return <div className="disclaimer">{t(lang, "disclaimerCompact")}</div>;
}

export function Dock() {
  const lang = useStore((s) => s.lang);
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const items = [
    { id: "map" as const, icon: MapIcon, label: t(lang, "map") },
    { id: "signals" as const, icon: Radio, label: t(lang, "signals") },
    { id: "history" as const, icon: Layers, label: t(lang, "history") },
    { id: "more" as const, icon: BookOpen, label: t(lang, "more") },
  ];
  return (
    <>
      <nav className="dock">
        {items.map((it) => (
          <button key={it.id} className={`dock-btn ${view === it.id ? "active" : ""}`} onClick={() => setView(it.id)}>
            <it.icon size={20} />
            {it.label}
          </button>
        ))}
      </nav>
      <nav className="side-nav">
        {items.map((it) => (
          <button key={it.id} className={`fab panel ${view === it.id ? "active" : ""}`} onClick={() => setView(it.id)}>
            <it.icon size={18} /> <span>{it.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export function Fabs() {
  const lang = useStore((s) => s.lang);
  const view = useStore((s) => s.view);
  const showPazp = useStore((s) => s.showPazp);
  const pitch3d = useStore((s) => s.pitch3d);
  const setShowPazp = useStore((s) => s.setShowPazp);
  const setPitch3d = useStore((s) => s.setPitch3d);
  const setCameraPreset = useStore((s) => s.setCameraPreset);
  const bumpCamera = useStore((s) => s.bumpCamera);
  const setDrawer = useStore((s) => s.setDrawer);
  const homeVoiv = useStore((s) => s.homeVoiv);
  const showCivAdsb = useStore((s) => s.showCivAdsb);
  const showMilAdsb = useStore((s) => s.showMilAdsb);
  const showNeptun = useStore((s) => s.showNeptun);
  const showUaAlerts = useStore((s) => s.showUaAlerts);
  const setShowCivAdsb = useStore((s) => s.setShowCivAdsb);
  const setShowMilAdsb = useStore((s) => s.setShowMilAdsb);
  const setShowNeptun = useStore((s) => s.setShowNeptun);
  const setShowUaAlerts = useStore((s) => s.setShowUaAlerts);
  if (view !== "map") return null;

  return (
    <div className="fabs">
      <div className="layer-bar">
        <button className={`chip ${showCivAdsb ? "on" : ""}`} onClick={() => setShowCivAdsb(!showCivAdsb)}>
          {t(lang, "layerCiv")}
        </button>
        <button className={`chip ${showMilAdsb ? "on" : ""}`} onClick={() => setShowMilAdsb(!showMilAdsb)}>
          {t(lang, "layerMil")}
        </button>
        <button className={`chip ${showNeptun ? "on" : ""}`} onClick={() => setShowNeptun(!showNeptun)}>
          {t(lang, "layerNeptun")}
        </button>
        <button className={`chip ${showUaAlerts ? "on" : ""}`} onClick={() => setShowUaAlerts(!showUaAlerts)}>
          {t(lang, "layerUa")}
        </button>
      </div>
      <button className="fab panel" onClick={() => setCameraPreset(homeVoiv ? "region" : "default")}>
        <UserRound size={18} /> <span>{t(lang, "myRegion")}</span>
      </button>
      <button className="fab panel" onClick={() => setShowPazp(!showPazp)} aria-pressed={showPazp}>
        <BoxSelect size={18} /> <span>{t(lang, "pazp")} {showPazp ? t(lang, "on") : t(lang, "off")}</span>
      </button>
      <button className="fab panel" onClick={() => setCameraPreset("pl")}>
        <MapIcon size={18} /> <span>{t(lang, "wholePl")}</span>
      </button>
      <button className="fab panel" onClick={() => setCameraPreset("flank")}>
        <Layers size={18} /> <span>{t(lang, "flank")}</span>
      </button>
      <button className="fab panel" onClick={() => setPitch3d(!pitch3d)}>
        <Box size={18} /> <span>{pitch3d ? t(lang, "mode3d") : t(lang, "mode2d")}</span>
      </button>
      <button className="fab panel" onClick={() => setDrawer({ kind: "legend" })}>
        <Radio size={18} /> <span>{t(lang, "legend")}</span>
      </button>
      <button className="fab panel" onClick={() => bumpCamera()} aria-label={t(lang, "resetCam")}>
        <Crosshair size={18} /> <span>{t(lang, "resetCam")}</span>
      </button>
    </div>
  );
}

export function HoverTip() {
  const hover = useStore((s) => s.hoverVoiv);
  const state = useStore((s) => s.state);
  const lang = useStore((s) => s.lang);
  if (!hover || !state) return null;
  const v = state.voivodeships.find((x) => x.id === hover);
  if (!v) return null;
  const name = lang === "en" ? v.nameEn : v.name;
  const extra =
    v.paint === "info"
      ? t(lang, "hoverEmpty")
      : (lang === "en" ? v.whyEn : v.whyPl) ||
        (v.paint === "transfer" ? `${t(lang, "transferFrom")} ${v.transferred_from[0]?.name ?? ""}` : strongestSource(v.breakdown));
  return (
    <div className="tooltip panel" style={{ top: 108, left: 16 }}>
      {name} · {fmtPts(v.points, lang)} {t(lang, "pts")} · {extra}
    </div>
  );
}

export function StatusBanners() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const offline = useStore((s) => s.offline);
  const historyMode = useStore((s) => s.historyMode);
  const setHistoryMode = useStore((s) => s.setHistoryMode);
  if (historyMode) {
    return (
      <div className="banner panel warn row space">
        <span>{t(lang, "historyBanner")}</span>
        <button className="ghost" onClick={() => setHistoryMode(false)}>
          {t(lang, "backLive")}
        </button>
      </div>
    );
  }
  if (offline && state) {
    return (
      <div className="banner panel warn">
        {t(lang, "offline")} {new Date(state.generated_at).toLocaleTimeString(lang === "en" ? "en-GB" : "pl-PL")}
      </div>
    );
  }
  const dead = state?.sources.filter((s) => s.diode === "dead") ?? [];
  if (dead.length) {
    return <div className="banner panel warn">{t(lang, "partial")}</div>;
  }
  return null;
}

export { EAST_IDS, ageLabel };
