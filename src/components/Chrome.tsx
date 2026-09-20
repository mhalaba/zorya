import { s } from "../strings";
import { useStore } from "../store";
import { MarkSvg } from "./ui";

/** Tiny brand + live diode. No tools, no layer toggles. */
export function MapHud() {
  const fusion = useStore((s) => s.state);
  const connecting = useStore((s) => s.connecting);
  const offline = useStore((s) => s.offline);
  const mode = connecting && !fusion ? "wait" : fusion && !offline ? "on" : "off";
  const label = mode === "on" ? "na żywo" : mode === "wait" ? "łączenie" : "offline";

  return (
    <div className="map-hud">
      <MarkSvg />
      <span className="wm">{s("brand.wordmark")}</span>
      <span className={`map-diode ${mode}`} title={label} aria-label={label} />
    </div>
  );
}
