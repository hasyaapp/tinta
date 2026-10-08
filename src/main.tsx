import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource/baloo-2/600.css";
import "@fontsource/baloo-2/700.css";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "./styles/base.css";
import "./styles/home.css";
import "./styles/canvas.css";
import "./styles/panels.css";
import "./styles/customize.css";
import "./styles/gestures.css";
import "./book.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  // Updates install in the background and wait until every tab from the old
  // version is closed; a running drawing session is never reloaded under it.
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => console.warn("Offline cache unavailable", error));
  });
}
