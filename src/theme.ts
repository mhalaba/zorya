import { useEffect } from "react";
import { useStore } from "./store";

export function applyTheme(theme: "noc" | "dzien" | "system", reduceMotion: boolean) {
  const html = document.documentElement;
  if (theme === "system") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", theme);
  html.classList.toggle("reduce-motion", reduceMotion);
}

export function ThemeSync() {
  const theme = useStore((s) => s.theme);
  const reduceMotion = useStore((s) => s.reduceMotion);
  useEffect(() => {
    applyTheme(theme, reduceMotion);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const on = () => applyTheme(useStore.getState().theme, useStore.getState().reduceMotion);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme, reduceMotion]);
  return null;
}
