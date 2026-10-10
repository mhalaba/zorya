import { lazy, Suspense, useEffect } from "react";
import { usePath } from "./nav";
import { ThemeSync } from "./theme";
import { AboutPage, ContactPage, HowPage, Landing, PrivacyPage, SourcesPage, StatusPage, NotFoundPage } from "./site/Site";
import { syncPushSubscription } from "./push";
import { useStore } from "./store";
import { syncHead } from "./seo/head";

// The map (MapLibre, ~1 MB) loads only on /app: the public pages stay light.
const AppShell = lazy(() => import("./app/AppShell").then((m) => ({ default: m.AppShell })));

export function App() {
  const path = usePath();
  const notifyGranted = useStore((s) => s.notifyGranted);
  const areas = useStore((s) => s.areas);

  useEffect(() => {
    syncHead(path);
  }, [path]);

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
      {path === "/" || path === "" || path === "/index.html" ? (
        <Landing />
      ) : path.startsWith("/app") ? (
        <Suspense fallback={<div className="app-root map-view" />}>
          <AppShell />
        </Suspense>
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
      ) : path.startsWith("/o-projekcie") ? (
        <AboutPage lang="pl" />
      ) : path.startsWith("/en/about") || path.startsWith("/about") ? (
        <AboutPage lang="en" />
      ) : (
        <NotFoundPage />
      )}
    </>
  );
}
