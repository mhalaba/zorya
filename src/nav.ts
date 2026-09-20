import { useEffect, useState } from "react";

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState({}, "", to);
  else history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath(): string {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function useSearch(): URLSearchParams {
  const [q, setQ] = useState(() => new URLSearchParams(location.search));
  useEffect(() => {
    const onPop = () => setQ(new URLSearchParams(location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return q;
}

export function fixtureParam(): string | null {
  const v = new URLSearchParams(location.search).get("fixture");
  return v;
}

export function withQuery(path: string): string {
  const q = location.search;
  if (!q) return path;
  return path.includes("?") ? `${path}&${q.slice(1)}` : `${path}${q}`;
}

export function go(path: string, replace = false) {
  navigate(withQuery(path), replace);
}
