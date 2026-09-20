import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

try {
  const raw = localStorage.getItem("zorya-local-v2");
  const theme = raw ? (JSON.parse(raw) as { state?: { theme?: string } }).state?.theme : undefined;
  if (theme === "noc" || theme === "dzien") document.documentElement.setAttribute("data-theme", theme);
  else if (!document.documentElement.getAttribute("data-theme")) document.documentElement.setAttribute("data-theme", "noc");
} catch {
  document.documentElement.setAttribute("data-theme", "noc");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
