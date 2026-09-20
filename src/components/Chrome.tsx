import type { Level, NavId } from "../model";
import { s } from "../strings";
import { go } from "../nav";
import { areaChipName } from "../format";
import { useStore } from "../store";
import { NAV_ICONS, PinIcon } from "./ui";

export function AppHeader({ level }: { level: Level }) {
  const areas = useStore((s) => s.areas);
  const selected = useStore((s) => s.selectedAreaId);
  const setSheet = useStore((s) => s.setSheet);
  const primary = areas.find((a) => a.area.id === selected) ?? areas.find((a) => a.primary) ?? areas[0];
  const extra = Math.max(0, areas.length - 1);
  const label = primary ? areaChipName(primary.area.name) : s("home.no_areas");
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
        <img className="mark" src="/icons/zorya-mark-mono.svg" alt="" />
        <span className="wm">{s("brand.wordmark")}</span>
      </a>
      <button
        type="button"
        className="chip"
        aria-haspopup="listbox"
        aria-label={s("header.area_a11y", { area: label })}
        onClick={() => setSheet({ kind: "areas" })}
      >
        <PinIcon />
        {label}
        {more}
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
