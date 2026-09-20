import { s } from "../strings";
import { useStore } from "../store";
import { EventCard } from "../components/Feed";
import { SheetFrame } from "../components/ui";

export function Mapa() {
  const layers = useStore((x) => x.mapLayers);
  const setMapLayer = useStore((x) => x.setMapLayer);
  const offline = useStore((x) => x.offline);
  const horizon = useStore((x) => x.horizon);
  const sheet = useStore((x) => x.sheet);
  const setSheet = useStore((x) => x.setSheet);
  const event = sheet?.kind === "map-event" ? horizon?.events.find((e) => e.id === sheet.id) : null;

  return (
    <main className={`map${offline ? " greyed" : ""}`} aria-label={s("map.a11y")}>
      <svg className="base" viewBox="0 0 390 560" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="390" height="560" fill="var(--z-map-land)" />
        <path d="M0 380 C 60 350, 120 420, 200 400 S 330 330, 390 360 L390 560 L0 560 Z" fill="var(--z-map-water)" />
        <g stroke="var(--z-map-roads)" strokeWidth="1.5" fill="none">
          <path d="M0 120 L390 90" />
          <path d="M60 0 L140 560" />
          <path d="M0 250 C 100 240, 200 300, 390 260" />
          <path d="M250 0 L300 380" />
        </g>
        {layers.areas && (
          <g stroke="var(--z-map-boundary)" strokeWidth="1" strokeDasharray="4 3" fill="none">
            <path d="M0 200 L90 180 L170 220 L260 170 L390 190" />
            <path d="M170 220 L190 380" />
          </g>
        )}
        {layers.events && (
          <>
            <g
              fill="var(--z-status-obserwacja)"
              fillOpacity="0.18"
              stroke="var(--z-status-obserwacja)"
              strokeWidth="1.5"
              onClick={() => {
                const id = horizon?.events.find((e) => e.level !== "alarm")?.id ?? horizon?.events[0]?.id;
                if (id) setSheet({ kind: "map-event", id });
              }}
            >
              <path d="M40 150 L120 110 L230 140 L240 230 L150 290 L60 250 Z" />
            </g>
            <g fill="var(--z-status-obserwacja)">
              <circle
                cx="150"
                cy="200"
                r="6"
                onClick={() => {
                  const id = horizon?.events[0]?.id;
                  if (id) setSheet({ kind: "map-event", id });
                }}
              />
            </g>
            {horizon?.events.some((e) => e.level === "alarm") && (
              <g fill="var(--z-status-alarm)" fillOpacity="0.18" stroke="var(--z-status-alarm)" strokeWidth="1.5">
                <path d="M240 250 L330 230 L360 320 L280 360 L230 310 Z" />
                <circle cx="297" cy="305" r="6" fill="var(--z-status-alarm)" />
              </g>
            )}
          </>
        )}
        {layers.sensors && (
          <g stroke="var(--z-line-strong)" strokeWidth="1.5" fill="var(--z-bg-raised)">
            <rect x="292" y="300" width="10" height="10" onClick={() => setSheet({ kind: "map-sensor", id: "3" })} />
            <rect x="88" y="330" width="10" height="10" onClick={() => setSheet({ kind: "map-sensor", id: "2" })} />
            <rect x="200" y="60" width="10" height="10" onClick={() => setSheet({ kind: "map-sensor", id: "1" })} />
          </g>
        )}
        <g fontFamily="var(--z-font-ui)" fontSize="12" fill="var(--z-text-2)">
          <text x="150" y="222" textAnchor="middle" fontWeight="700" fill="var(--z-text)">
            Brzegowo
          </text>
          <text x="300" y="325" textAnchor="middle">
            Nadwiśle
          </text>
          <text x="96" y="356" textAnchor="middle">
            Zaborów
          </text>
        </g>
      </svg>
      <div className="map-chips">
        <button type="button" className={`chip${layers.events ? " on" : ""}`} onClick={() => setMapLayer("events", !layers.events)}>
          {s("map.layer_events")}
        </button>
        <button type="button" className={`chip${layers.sensors ? " on" : ""}`} onClick={() => setMapLayer("sensors", !layers.sensors)}>
          {s("map.layer_sensors")}
        </button>
        <button type="button" className={`chip${layers.areas ? " on" : ""}`} onClick={() => setMapLayer("areas", !layers.areas)}>
          {s("map.layer_areas")}
        </button>
      </div>
      <svg className="map-north" viewBox="0 0 14 32" aria-label={s("map.north")}>
        <text x="7" y="9" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--z-text)" fontFamily="var(--z-font-ui)">
          N
        </text>
        <path d="M7 12 L10 24 L4 24 Z" fill="var(--z-text)" />
        <path d="M4 26 L10 26 L7 32 Z" fill="var(--z-text-2)" />
      </svg>
      <div className="legend" aria-label={s("map.legend")}>
        <div>
          <i className="dot event" />
          {s("map.legend_event", { level: s("levels.obserwacja") })}
        </div>
        <div>
          <i className="area" />
          {s("map.legend_area")}
        </div>
        <div>
          <i className="sensor" />
          {s("map.legend_sensor")}
        </div>
        <div>
          <i className="bound" />
          {s("map.legend_boundary")}
        </div>
      </div>
      <div className="map-attr">{s("pages.map_own")}</div>
      {event && (
        <SheetFrame title={event.title} onClose={() => setSheet(null)}>
          <EventCard event={event} />
        </SheetFrame>
      )}
      {sheet?.kind === "map-sensor" && (
        <SheetFrame title={s("map.legend_sensor")} onClose={() => setSheet(null)}>
          <p>czujnik akustyczny nr {sheet.id}</p>
          <p className="note">{s("map.sensor_last", { time: horizon ? "" : s("home.loading") })} {horizon?.status.data_as_of}</p>
        </SheetFrame>
      )}
    </main>
  );
}
