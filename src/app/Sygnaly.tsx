import { useEffect, useState } from "react";
import type { Signal, Source } from "../model";
import { s } from "../strings";
import { fmtTime } from "../format";
import { fetchSourceItems } from "../api";
import { go } from "../nav";
import { useStore } from "../store";
import { HealthDot, Toggle } from "../components/ui";

function healthTime(src: Source): string {
  if (src.health === "disabled") return s("sources.health_disabled");
  if (!src.last_update) return s("sources.health_disabled");
  if (src.health === "fresh") return s("sources.health_fresh", { time: fmtTime(src.last_update) });
  if (src.health === "down") return s("sources.health_down", { time: fmtTime(src.last_update) });
  return s("sources.health_stale", { time: fmtTime(src.last_update) });
}

export function Sygnaly() {
  const horizon = useStore((x) => x.horizon);
  const sources = horizon?.sources ?? [];
  return (
    <>
      <h1 className="screen">{s("sources.title")}</h1>
      <p className="note pad">{s("sources.intro")}</p>
      <div className="list">
        {sources.map((src) => (
          <button type="button" className="li" key={src.id} onClick={() => go(`/app/sygnaly/${src.id}`)}>
            <span className="t">{src.name}</span>
            <span className="d">{src.enabled ? src.description : s("sources.disabled_by_you")}</span>
            <HealthDot health={src.enabled ? src.health : "disabled"} time={healthTime(src)} />
          </button>
        ))}
      </div>
      <div className="eyebrow">
        <span className="z-label">{s("sources.how")}</span>
      </div>
      <p className="note pad">{s("sources.how_text")}</p>
    </>
  );
}

export function Zrodlo({ id }: { id: string }) {
  const horizon = useStore((x) => x.horizon);
  const sourceOn = useStore((x) => x.sourceOn);
  const setSourceOn = useStore((x) => x.setSourceOn);
  const [data, setData] = useState<{ source: Source; items: Signal[] } | null>(null);

  useEffect(() => {
    void fetchSourceItems(id).then(setData);
  }, [id]);

  const source = data?.source ?? horizon?.sources.find((x) => x.id === id);
  if (!source) return <p className="empty">{s("home.loading")}</p>;
  const locked = source.locked || source.id === "rcb";
  const enabled = sourceOn[source.id] !== false && source.enabled;

  return (
    <>
      <h1 className="screen">{source.name}</h1>
      <p className="note pad">{source.description}</p>
      <div className="list">
        <div className="li">
          <span className="t">{source.name}</span>
          <span className="d">{locked ? s("sources.cannot_disable") : source.attribution}</span>
          <Toggle
            on={enabled}
            locked={locked}
            label={source.name}
            onChange={(v) => setSourceOn(source.id, v)}
          />
        </div>
      </div>
      <div className="eyebrow">
        <span className="z-label">{s("sources.licence")}</span>
      </div>
      <p className="note pad">{source.attribution || "—"}</p>
      <div className="eyebrow">
        <span className="z-label">{s("sources.recent")}</span>
      </div>
      <div className="list">
        {(data?.items ?? []).map((it) => (
          <div className="li" key={it.id}>
            <span className="t">{it.text}</span>
            <span className="d">{it.meta}</span>
            <span className="r">{fmtTime(it.observed_at)}</span>
          </div>
        ))}
      </div>
      <p className="note pad">
        <button type="button" className="linkish" onClick={() => go("/app/sygnaly")}>
          {s("nav.back")}
        </button>
      </p>
    </>
  );
}
