import type { FusionState, HistoryBundle } from "./types";

function root(backendUrl: string) {
  return backendUrl.replace(/\/$/, "");
}

export async function fetchState(backendUrl: string): Promise<FusionState> {
  const r = await fetch(`${root(backendUrl) || ""}/api/state`);
  if (!r.ok) throw new Error(`state ${r.status}`);
  return r.json();
}

export async function fetchHistory(backendUrl: string, hours = 12): Promise<HistoryBundle> {
  const r = await fetch(`${root(backendUrl) || ""}/api/history/bundle?hours=${hours}`);
  if (!r.ok) throw new Error(`history ${r.status}`);
  return r.json();
}

export function openStateSocket(backendUrl: string, onState: (s: FusionState) => void, onClose: () => void) {
  const base = root(backendUrl);
  let url: string;
  if (base) {
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/api/ws";
    url = u.toString();
  } else {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    url = `${proto}://${location.host}/api/ws`;
  }
  const ws = new WebSocket(url);
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state" && msg.state) onState(msg.state);
    } catch {
      /* ignore */
    }
  };
  ws.onclose = onClose;
  ws.onerror = () => ws.close();
  return ws;
}
