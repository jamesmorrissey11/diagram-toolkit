// Finds a local Chrome-family browser and drives it over the DevTools protocol (no npm deps; Node >= 22 WebSocket).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CANDIDATES = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "microsoft-edge-stable"],
  win32: [
    `${process.env["PROGRAMFILES"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};

function onPath(cmd) {
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    const p = path.join(dir, cmd);
    if (existsSync(p)) return p;
  }
  return null;
}

export function findChrome() {
  const override = process.env.DIAGRAM_CHROME_PATH;
  if (override) {
    if (!existsSync(override)) throw new Error(`DIAGRAM_CHROME_PATH=${override} does not exist`);
    return override;
  }
  for (const c of CANDIDATES[process.platform] || []) {
    const p = path.isAbsolute(c) ? (existsSync(c) ? c : null) : onPath(c);
    if (p) return p;
  }
  throw new Error(
    "No Chrome, Chromium, Edge or Brave found. Install Google Chrome, or set DIAGRAM_CHROME_PATH to a Chrome-family executable.",
  );
}

export async function launchChrome() {
  if (typeof WebSocket === "undefined") throw new Error(`Node ${process.version} lacks a global WebSocket; Node >= 22 is required.`);
  const exe = findChrome();
  const profile = await mkdtemp(path.join(os.tmpdir(), "diagram-toolkit-chrome-"));
  const proc = spawn(exe, [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start within 20s (${exe})`)), 20000);
    proc.stderr.on("data", (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited early (code ${code}): ${buf.slice(-500)}`)); });
  });
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("CDP websocket failed")); });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  async function newPage({ width = 1600, height = 1200 } = {}) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await s("Page.enable");
    await s("Runtime.enable");
    await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    const evaluate = async (expression) => {
      const r = await s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    return {
      evaluate,
      async goto(url, readyExpr) {
        await s("Page.navigate", { url });
        for (let i = 0; i < 400; i++) {
          if (await evaluate(readyExpr).catch(() => false)) return;
          await new Promise((r) => setTimeout(r, 25));
        }
        throw new Error(`page not ready: ${url}`);
      },
      async screenshot(clip, scale = 1) {
        const { data } = await s("Page.captureScreenshot", { format: "png", clip: { ...clip, scale }, captureBeyondViewport: true });
        return Buffer.from(data, "base64");
      },
      async setViewport(width, height) {
        await s("Emulation.setDeviceMetricsOverride", { width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 1, mobile: false });
      },
      close: () => send("Target.closeTarget", { targetId }),
    };
  }

  return {
    exe,
    newPage,
    async close() {
      try { await send("Browser.close"); } catch {}
      ws.close();
      proc.kill();
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}
