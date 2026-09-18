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

/** A usable backend URL: empty (same origin) or an absolute http(s) URL. */
export function isValidBackendUrl(backendUrl: string) {
  const base = root(backendUrl.trim());
  if (!base) return true;
  try {
    return /^https?:$/.test(new URL(base).protocol);
  } catch {
    return false;
  }
}

/** Returns null when the backend URL cannot be turned into a WebSocket URL. */
export function openStateSocket(backendUrl: string, onState: (s: FusionState) => void, onClose: () => void) {
  const base = root(backendUrl);
  let url: string;
  if (base) {
    if (!isValidBackendUrl(base)) return null;
    const u = new URL(base);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    // Keep a path prefix (https://host/zorya), same as fetchState does.
    u.pathname = `${u.pathname.replace(/\/$/, "")}/api/ws`;
    url = u.toString();
  } else {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    url = `${proto}://${location.host}/api/ws`;
  }
  let ws: WebSocket;
  try {
    ws = new WebSocket(url);
  } catch {
    return null;
  }
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
