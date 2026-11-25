// Dev-only: mounts the real Excalidraw 0.18.1 editor to simulate "open in Excalidraw, then save".
import React from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
window.__roundTrip = (scene) => new Promise((resolve) => {
  const el = document.getElementById("app");
  const root = createRoot(el);
  const onApi = (api) => {
    if (!api) return;
    setTimeout(() => {
      const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
      root.unmount();
      resolve(json);
    }, 1500);
  };
  root.render(React.createElement(Excalidraw, { initialData: { elements: scene.elements, appState: scene.appState, files: scene.files }, excalidrawAPI: onApi }));
});
window.__ready = true;
