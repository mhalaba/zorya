import { useEffect } from "react";
import { fetchHorizon, fetchState, openStateSocket } from "./api";
import { maybeNotify } from "./notify";
import { useStore } from "./store";

/** Live fusion: GET /api/state then WS /api/ws. Also refreshes horizon so Horyzont stays in sync. */
export function useLiveFusion() {
  const backendUrl = useStore((s) => s.backendUrl);
  const setLiveState = useStore((s) => s.setLiveState);
  const setConnecting = useStore((s) => s.setConnecting);
  const setOffline = useStore((s) => s.setOffline);
  const setHorizon = useStore((s) => s.setHorizon);
  const cacheHorizon = useStore((s) => s.cacheHorizon);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;
    setConnecting(true);

    const refreshHorizon = () => {
      void fetchHorizon(useStore.getState().selectedAreaId)
        .then((h) => {
          if (closed) return;
          setHorizon(h, { sample: h.sample, offline: false, loading: false, error: null });
          cacheHorizon(h);
          maybeNotify(h);
        })
        .catch(() => {
          /* keep last horizon; fusion map still updates */
        });
    };

    const apply = (s: Parameters<typeof setLiveState>[0]) => {
      setLiveState(s);
      refreshHorizon();
    };

    const load = () =>
      fetchState(backendUrl)
        .then((s) => {
          if (!closed) apply(s);
        })
        .catch(() => {
          if (!closed) setOffline(true);
        });

    const reconnectLater = () => {
      if (closed) return;
      setOffline(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void load();
        connect();
      }, Math.min(30_000, 1000 * 2 ** retry++));
    };

    const connect = () => {
      if (closed) return;
      const old = ws;
      ws = null;
      old?.close();
      const sock = openStateSocket(backendUrl, (s) => {
        retry = 0;
        apply(s);
      }, () => {
        if (sock === ws) reconnectLater();
      });
      ws = sock;
      if (!sock) setOffline(true);
    };

    const wake = () => {
      if (closed || document.hidden) return;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
      retry = 0;
      reconnectLater();
    };

    void load();
    connect();
    const poll = window.setInterval(() => void load(), 60_000);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      closed = true;
      window.clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      ws?.close();
    };
  }, [backendUrl, cacheHorizon, setConnecting, setHorizon, setLiveState, setOffline]);
}
