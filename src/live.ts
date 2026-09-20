import { useEffect } from "react";
import { fetchState, openStateSocket } from "./api";
import { useStore } from "./store";

/** Live fusion for the map: GET /api/state then WS /api/ws. Horizon is a separate civic feed. */
export function useLiveFusion() {
  const backendUrl = useStore((s) => s.backendUrl);
  const setLiveState = useStore((s) => s.setLiveState);
  const setConnecting = useStore((s) => s.setConnecting);
  const setOffline = useStore((s) => s.setOffline);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: number | undefined;
    setConnecting(true);

    const apply = (s: Parameters<typeof setLiveState>[0]) => {
      setLiveState(s);
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
  }, [backendUrl, setConnecting, setLiveState, setOffline]);
}
