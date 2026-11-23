// Browser page script, bundled into engine/vendor/excalidraw-render.js by scripts/build-vendor.mjs.
import { exportToSvg } from "@excalidraw/excalidraw";
window.__exportToSvg = async (scene, padding = 48) => {
  const svg = await exportToSvg({
    elements: scene.elements,
    appState: { exportBackground: true, viewBackgroundColor: "#ffffff", ...(scene.appState || {}) },
    files: scene.files || {},
    exportPadding: padding,
  });
  return svg.outerHTML;
};
window.__ready = true;
