import { useEffect } from "react";
import { usePath } from "./nav";
import { ThemeSync } from "./theme";
import { AppShell } from "./app/AppShell";
import { ContactPage, HowPage, Landing, PrivacyPage, SourcesPage, StatusPage } from "./site/Site";
import { syncPushSubscription } from "./push";
import { useStore } from "./store";

export function App() {
  const path = usePath();
  const notifyGranted = useStore((s) => s.notifyGranted);
  const areas = useStore((s) => s.areas);

  useEffect(() => {
    document.documentElement.lang = "pl";
    document.title = "Zorya — czuwanie świtu";
  }, []);

  useEffect(() => {
    void syncPushSubscription();
  }, [notifyGranted, areas]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const url = new URL(href, location.origin);
      history.pushState({}, "", url.pathname + url.search + url.hash);
      window.dispatchEvent(new PopStateEvent("popstate"));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <ThemeSync />
      {path === "/" || path === "" ? (
        <Landing />
      ) : path.startsWith("/app") ? (
        <AppShell />
      ) : path.startsWith("/jak-dziala") ? (
        <HowPage />
      ) : path.startsWith("/prywatnosc") ? (
        <PrivacyPage />
      ) : path.startsWith("/status") ? (
        <StatusPage />
      ) : path.startsWith("/zrodla") ? (
        <SourcesPage />
      ) : path.startsWith("/kontakt") ? (
        <ContactPage />
      ) : (
        <Landing />
      )}
    </>
  );
}
