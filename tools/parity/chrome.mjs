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
