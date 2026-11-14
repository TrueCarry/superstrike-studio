// Shared by the screenshot and clip tools: the installed Chrome or Edge, and the dev server.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SERVER = "http://127.0.0.1:8017/";

const BROWSERS = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export function findBrowser() {
  const browser = BROWSERS.find((b) => existsSync(b));
  if (!browser) throw new Error("no Chrome or Edge found; set CHROME=/path/to/chrome");
  return browser;
}

async function serverUp() {
  try {
    return (await fetch(SERVER)).ok;
  } catch {
    return false;
  }
}

/**
 * Starts headless Chrome on `url` with a DevTools connection. Returns `send` (any CDP method),
 * `evaluate` (an expression, awaited, by value) and `close`.
 */
export async function headless(url, { port = 9334, flags = [] } = {}) {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const profile = mkdtempSync(join(tmpdir(), "ss-headless-"));
  const chrome = spawn(findBrowser(), [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--force-device-scale-factor=1", "--hide-scrollbars",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...flags, url,
  ], { stdio: "ignore" });
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const page = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((p) => p.type === "page");
      if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
    if (!ws) await new Promise((r) => setTimeout(r, 250));
  }
  if (!ws) throw new Error("headless Chrome did not start");
  const waiting = new Map();
  let id = 0;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    msg.error ? w.reject(new Error(msg.error.message)) : w.resolve(msg.result);
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      waiting.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const close = async () => {
    ws.close();
    chrome.kill();
    await new Promise((r) => setTimeout(r, 500));
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  return { send, evaluate, close };
}

/** Uses the dev server when it runs, otherwise starts one. Returns the started process (kill it when done) or null. */
export async function ensureServer() {
  if (await serverUp()) return null;
  const child = spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js")], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await serverUp()) return child;
  }
  child.kill();
  throw new Error("the dev server did not start (npm install first?)");
}
