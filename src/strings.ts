import raw from "./ui-strings.pl.json";

type Node = string | string[] | { [k: string]: Node };

const tree = raw as unknown as { [k: string]: Node };

export function s(path: string, vars?: Record<string, string | number>): string {
  const parts = path.split(".");
  let cur: Node | undefined = tree as Node;
  for (const p of parts) {
    if (cur && typeof cur === "object" && !Array.isArray(cur) && p in cur) cur = cur[p];
    else return path;
  }
  if (typeof cur !== "string") return path;
  if (!vars) return cur;
  return cur.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function statusEventsLine(n: number, time: string): string {
  if (n === 1) return s("home.status_events", { n, time });
  if (n >= 2 && n <= 4) return s("home.status_events_plural", { n, time });
  return s("home.status_events_plural5", { n, time });
}
