// Dev-only: mounts the real Excalidraw 0.18.1 editor to simulate "open in Excalidraw, then save".
import React from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw, serializeAsJSON, newElementWith } from "@excalidraw/excalidraw";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mount = (scene, act) => new Promise((resolve, reject) => {
  const el = document.getElementById("app");
  const root = createRoot(el);
  const onApi = (api) => {
    if (!api) return;
    setTimeout(async () => {
      try {
        const info = act ? await act(api) : null;
        const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
        root.unmount();
        resolve(act ? JSON.stringify({ info, json }) : json);
      } catch (e) { root.unmount(); reject(e); }
    }, 1500);
  };
  root.render(React.createElement(Excalidraw, { initialData: { elements: scene.elements, appState: scene.appState, files: scene.files }, excalidrawAPI: onApi }));
});

window.__roundTrip = (scene) => mount(scene);

// Board edit: drag the first card/cell group by +40px, then edit one card text and one sticky note through Excalidraw's own
// text editor (select, Enter, type, Escape), exactly as a user would.
window.__editRoundTrip = (scene) => mount(scene, async (api) => {
  const els = api.getSceneElements();
  const gid = els.flatMap((e) => e.groupIds).find((g) => /^(card|cell)_/.test(g));
  api.updateScene({ elements: els.map((e) => (e.groupIds.includes(gid) ? newElementWith(e, { x: e.x + 40 }) : e)) });
  const edited = [];
  for (const kind of ["text", "itemText"]) {
    const t = api.getSceneElements().find((e) => e.customData?.dt?.kind === kind);
    if (!t) continue;
    api.updateScene({ appState: { selectedElementIds: { [t.containerId || t.id]: true }, selectedGroupIds: {}, editingGroupId: gid } });
    await sleep(100);
    document.querySelector(".excalidraw").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(300);
    const ta = document.querySelector("textarea.excalidraw-wysiwyg");
    if (!ta) { edited.push({ id: t.id, viaEditor: false }); continue; }
    ta.value = `${ta.value} (edited)`;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(100);
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(300);
    edited.push({ id: t.id, viaEditor: true });
  }
  return { gid, edited };
});
window.__ready = true;
