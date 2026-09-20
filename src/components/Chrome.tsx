import { Box, BoxSelect, Crosshair, Layers, Map as MapIcon, Radio, UserRound } from "lucide-react";
import type { Level, NavId } from "../model";
import { s } from "../strings";
import { t } from "../i18n";
import { go } from "../nav";
import { areaChipName } from "../format";
import { useStore } from "../store";
import { MarkSvg, NAV_ICONS, PinIcon } from "./ui";
import { EAST_IDS } from "../config";
import type { FusionState } from "../types";

function ChipBadge({ n }: { n: number }) {
  if (!n) return null;
  return <span className="chip-count">{n > 99 ? "99+" : n}</span>;
}

function fusionCounts(state: FusionState | null) {
  if (!state) return { civ: 0, mil: 0, neptun: 0, ua: 0 };
  return {
    civ: state.adsb.filter((a) => !a.mil).length,
    mil: state.adsb.filter((a) => a.mil).length,
    neptun: state.objects.length,
    ua: state.ua_alerts.filter((a) => a.active).length,
  };
}

export function AppHeader({ level }: { level: Level }) {
  const areas = useStore((s) => s.areas);
  const selected = useStore((s) => s.selectedAreaId);
  const setSheet = useStore((s) => s.setSheet);
  const primary = areas.find((a) => a.area.id === selected) ?? areas.find((a) => a.primary) ?? areas[0];
  const extra = Math.max(0, areas.length - 1);
  const label = primary ? areaChipName(primary.area.name) : s("settings.areas");
  const more = extra > 0 ? ` ${s("header.area_more", { n: extra })}` : "";

  return (
    <header className={`hdr lvl-${level}`}>
      <a
        className="brand"
        href="/app"
        aria-label={s("header.home_a11y")}
        onClick={(e) => {
          e.preventDefault();
          go("/app");
        }}
      >
        <MarkSvg />
        <span className="wm">{s("brand.wordmark")}</span>
      </a>
      <button
        type="button"
        className="chip area-chip"
        aria-haspopup="listbox"
        aria-label={s("header.area_a11y", { area: label })}
        onClick={() => setSheet({ kind: "areas" })}
      >
        <PinIcon />
        <span className="chip-txt">
          {label}
          {more}
        </span>
      </button>
    </header>
  );
}

export function BottomNav({ current }: { current: NavId }) {
  const items: { id: NavId; href: string; label: string }[] = [
    { id: "horyzont", href: "/app", label: s("nav.horyzont") },
    { id: "mapa", href: "/app/mapa", label: s("nav.mapa") },
    { id: "sygnaly", href: "/app/sygnaly", label: s("nav.sygnaly") },
    { id: "zglos", href: "/app/zglos", label: s("nav.zglos") },
    { id: "wiecej", href: "/app/wiecej", label: s("nav.wiecej") },
  ];
  return (
    <nav className="nav" aria-label={s("nav.a11y")}>
      {items.map((it) => (
        <a
          key={it.id}
          href={it.href}
          className={current === it.id ? "on" : ""}
          aria-current={current === it.id ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            go(it.href);
          }}
        >
          {NAV_ICONS[it.id]}
          {it.label}
        </a>
      ))}
    </nav>
  );
}

export function OfflineBar({ time }: { time: string }) {
  return <div className="offline-bar">{s("states.offline", { time })}</div>;
}

/** Live layer chips + map tools. Chips top-left, icons top-right — never one shared column. */
export function LiveMapTools() {
  const lang = useStore((s) => s.lang);
  const fusion = useStore((s) => s.state);
  const counts = fusionCounts(fusion);
  const showCivAdsb = useStore((s) => s.showCivAdsb);
  const showMilAdsb = useStore((s) => s.showMilAdsb);
  const showNeptun = useStore((s) => s.showNeptun);
  const showUaAlerts = useStore((s) => s.showUaAlerts);
  const setShowCivAdsb = useStore((s) => s.setShowCivAdsb);
  const setShowMilAdsb = useStore((s) => s.setShowMilAdsb);
  const setShowNeptun = useStore((s) => s.setShowNeptun);
  const setShowUaAlerts = useStore((s) => s.setShowUaAlerts);
  const showPazp = useStore((s) => s.showPazp);
  const pitch3d = useStore((s) => s.pitch3d);
  const setShowPazp = useStore((s) => s.setShowPazp);
  const setPitch3d = useStore((s) => s.setPitch3d);
  const setCameraPreset = useStore((s) => s.setCameraPreset);
  const bumpCamera = useStore((s) => s.bumpCamera);
  const setDrawer = useStore((s) => s.setDrawer);
  const homeVoiv = useStore((s) => s.homeVoiv);
  const selected = useStore((s) => s.selectedAreaId);
  const region = homeVoiv || (selected && EAST_IDS.includes(selected) ? selected : null);

  return (
    <>
      <div className="map-tools map-tools-start">
        <div className="map-chips">
          <button type="button" className={`chip${showCivAdsb ? " on" : ""}`} onClick={() => setShowCivAdsb(!showCivAdsb)}>
            {t(lang, "layerCiv")}
            <ChipBadge n={counts.civ} />
          </button>
          <button type="button" className={`chip${showMilAdsb ? " on" : ""}`} onClick={() => setShowMilAdsb(!showMilAdsb)}>
            {t(lang, "layerMil")}
            <ChipBadge n={counts.mil} />
          </button>
          <button type="button" className={`chip${showNeptun ? " on" : ""}`} onClick={() => setShowNeptun(!showNeptun)}>
            {t(lang, "layerNeptun")}
            <ChipBadge n={counts.neptun} />
          </button>
          <button type="button" className={`chip${showUaAlerts ? " on" : ""}`} onClick={() => setShowUaAlerts(!showUaAlerts)}>
            {t(lang, "layerUa")}
            <ChipBadge n={counts.ua} />
          </button>
        </div>
      </div>
      <div className="map-tools map-tools-end">
        <button type="button" className="map-fab" onClick={() => setCameraPreset(region ? "region" : "default")} aria-label={t(lang, "myRegion")}>
          <UserRound size={18} />
        </button>
        <button type="button" className={`map-fab${showPazp ? " on" : ""}`} onClick={() => setShowPazp(!showPazp)} aria-pressed={showPazp} aria-label={t(lang, "pazp")}>
          <BoxSelect size={18} />
        </button>
        <button type="button" className="map-fab" onClick={() => setCameraPreset("pl")} aria-label={t(lang, "wholePl")}>
          <MapIcon size={18} />
        </button>
        <button type="button" className="map-fab" onClick={() => setCameraPreset("flank")} aria-label={t(lang, "flank")}>
          <Layers size={18} />
        </button>
        <button type="button" className={`map-fab${pitch3d ? " on" : ""}`} onClick={() => setPitch3d(!pitch3d)} aria-pressed={pitch3d} aria-label={pitch3d ? t(lang, "mode3d") : t(lang, "mode2d")}>
          <Box size={18} />
        </button>
        <button type="button" className="map-fab" onClick={() => setDrawer({ kind: "legend" })} aria-label={t(lang, "legend")}>
          <Radio size={18} />
        </button>
        <button type="button" className="map-fab" onClick={() => bumpCamera()} aria-label={t(lang, "resetCam")}>
          <Crosshair size={18} />
        </button>
      </div>
    </>
  );
}
