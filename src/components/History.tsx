import { useEffect } from "react";
import { Pause, Play, X } from "lucide-react";
import { useStore } from "../store";
import { t } from "../i18n";
import { fetchHistory } from "../api";
import { fmtPts } from "../lib";

export function HistoryView() {
  const lang = useStore((s) => s.lang);
  const backendUrl = useStore((s) => s.backendUrl);
  const history = useStore((s) => s.history);
  const setHistory = useStore((s) => s.setHistory);
  const setView = useStore((s) => s.setView);
  const historyMode = useStore((s) => s.historyMode);
  const setHistoryMode = useStore((s) => s.setHistoryMode);
  const idx = useStore((s) => s.historyIdx);
  const setIdx = useStore((s) => s.setHistoryIdx);
  const playing = useStore((s) => s.historyPlaying);
  const setPlaying = useStore((s) => s.setHistoryPlaying);
  const speed = useStore((s) => s.historySpeed);
  const setSpeed = useStore((s) => s.setHistorySpeed);
  const live = useStore((s) => s.state);

  useEffect(() => {
    let cancel = false;
    if (!history) {
      fetchHistory(backendUrl, 12)
        .then((h) => {
          if (!cancel) {
            setHistory(h);
            setHistoryMode(true);
            setIdx(h.n - 1);
          }
        })
        .catch(() => undefined);
    } else if (!historyMode) {
      setHistoryMode(true);
    }
    return () => {
      cancel = true;
    };
  }, [backendUrl, history, historyMode, setHistory, setHistoryMode, setIdx]);

  useEffect(() => {
    if (!playing || !history) return;
    const ms = speed === 1 ? 80 : speed === 4 ? 20 : 8;
    const tmr = window.setInterval(() => {
      const next = useStore.getState().historyIdx + 1;
      if (!history || next >= history.n) {
        setPlaying(false);
        setIdx(history.n - 1);
      } else setIdx(next);
    }, ms);
    return () => clearInterval(tmr);
  }, [playing, speed, history, setIdx, setPlaying]);

  const t0 = history ? new Date(history.t0).getTime() : 0;
  const at = history ? new Date(t0 + idx * history.step_s * 1000) : new Date();
  const max = history?.max_pl[idx] ?? 0;
  const color = max >= 4 ? "#D7263D" : max >= 2 ? "#E0A100" : "#3DDC84";

  return (
    <section className="sheet panel panel-ornament">
      <div className="sheet-head">
        <h2>{t(lang, "history")}</h2>
        <button className="icon-btn" onClick={() => setView("map")} aria-label={t(lang, "close")}>
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body stack">
        <p className="tiny">{t(lang, "historyBanner")}</p>
        <div className="history-bar">
          <input
            type="range"
            min={0}
            max={Math.max(0, (history?.n ?? 1) - 1)}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
            style={{ accentColor: color }}
          />
          <div className="row space">
            <span className="tabular">{at.toLocaleString(lang === "en" ? "en-GB" : "pl-PL")}</span>
            <span className="tabular" style={{ color }}>
              max {fmtPts(max, lang)} {t(lang, "pts")}
            </span>
          </div>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setPlaying(!playing)}>
            {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? t(lang, "pause") : t(lang, "play")}
          </button>
          {([1, 4, 12] as const).map((s) => (
            <button key={s} className={`chip ${speed === s ? "on" : ""}`} onClick={() => setSpeed(s)}>
              ×{s}
            </button>
          ))}
        </div>
        <button className="primary" onClick={() => { setHistoryMode(false); setPlaying(false); setView("map"); }}>
          {t(lang, "backLive")}
        </button>
        <div className="voiv-list">
          {[...(live?.voivodeships ?? [])]
            .map((v) => ({ ...v, points: history?.voivodeships[v.id]?.[idx] ?? 0 }))
            .sort((a, b) => b.points - a.points || a.eastRank - b.eastRank)
            .map((v) => (
              <div key={v.id} className="voiv-card">
                <div className="row space">
                  <span>{lang === "en" ? v.nameEn : v.name}</span>
                  <strong className="tabular">{fmtPts(v.points, lang)}</strong>
                </div>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
