// "Studio": one headless Chrome page that measures text in real Excalidraw fonts and renders scenes with the
// vendored @excalidraw/excalidraw@0.18.1 exportToSvg. Static assets are served from a loopback-only HTTP server.
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome } from "./chrome.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, "../vendor");
const TYPES = { ".js": "text/javascript", ".woff2": "font/woff2", ".html": "text/html" };

function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      const u = decodeURIComponent(req.url.split("?")[0]);
      if (u === "/") {
        res.setHeader("content-type", "text/html");
        return res.end(`<!doctype html><html><body style="margin:0;background:#fff"><div id="stage"></div>` +
          `<script>window.EXCALIDRAW_ASSET_PATH="/assets/"</script><script src="/assets/excalidraw-render.js"></script></body></html>`);
      }
      if (!u.startsWith("/assets/")) throw new Error("nf");
      const file = path.normalize(path.join(VENDOR, u.slice(8)));
      if (!file.startsWith(VENDOR + path.sep)) throw new Error("nf");
      res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(await readFile(file));
    } catch { res.statusCode = 404; res.end("not found"); }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

export async function openStudio() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await launchChrome();
    const page = await browser.newPage();
    await page.goto(`${base}/`, "window.__ready === true");
    const loadedFonts = new Set();
    return {
      browserPath: browser.exe,
      /** items: [text, size][] measured in the preset's font. Returns tw(text,size). */
      async measure(preset, items) {
        const fam = `M_${preset.name}`;
        if (!loadedFonts.has(fam)) {
          const srcs = preset.font.files.map((f) => `url(/assets/fonts/${f})`);
          await page.evaluate(`(async()=>{${srcs.map((s, i) => `const f${i}=new FontFace(${JSON.stringify(fam + i)},${JSON.stringify(s)});await f${i}.load();document.fonts.add(f${i});`).join("")}return true})()`);
          loadedFonts.add(fam);
        }
        const stack = preset.font.files.map((_, i) => `"${fam}${i}"`).join(",");
        const keys = [...new Set(items.map((i) => JSON.stringify(i)))];
        const widths = await page.evaluate(`(()=>{const c=document.createElement("canvas").getContext("2d");const o={};for(const k of ${JSON.stringify(keys)}){const [s,z]=JSON.parse(k);c.font=z+"px "+${JSON.stringify(stack)};o[k]=c.measureText(s).width}return o})()`);
        return (s, size) => {
          const w = widths[JSON.stringify([s, size])];
          if (w === undefined) throw new Error(`unmeasured text ${JSON.stringify([s, size])}`);
          return Math.ceil(w);
        };
      },
      /** Renders scene -> <out>.svg and <out>.png (scale = device pixel ratio of the PNG). */
      async render(scene, outBase, { scale = 2 } = {}) {
        const svg = await page.evaluate(`window.__exportToSvg(${JSON.stringify(scene)})`);
        await writeFile(`${outBase}.svg`, svg);
        const box = await page.evaluate(`(async()=>{const s=document.getElementById("stage");s.innerHTML=${JSON.stringify(svg)};await document.fonts.ready;await new Promise(r=>setTimeout(r,120));const b=s.firstElementChild.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`);
        await page.setViewport(Math.max(800, box.width), Math.max(600, box.height));
        await writeFile(`${outBase}.png`, await page.screenshot(box, scale));
        await page.evaluate(`document.getElementById("stage").innerHTML="";true`);
        return { svg: `${outBase}.svg`, png: `${outBase}.png`, width: Math.round(box.width), height: Math.round(box.height) };
      },
      async close() { await browser.close(); server.close(); },
    };
  } catch (e) {
    server.close();
    if (browser) await browser.close();
    throw e;
  }
}
