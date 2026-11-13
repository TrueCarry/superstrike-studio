// Screenshot parity report: renders the web app with the demo mouse in headless Chrome, in the same
// states as the native app's docs/screenshots (upstream tools/screenshots/capture.sh), and writes
// tools/parity/out/report.html with native and web side by side, overlaid, and as a difference.
//   node tools/parity/shots.mjs [name ...]      (default: every shot)
// Uses the dev server on 127.0.0.1:8017 when it runs, otherwise starts one. No extra packages.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "tools/parity/out");
const NATIVE_COMMIT = "991cbfc"; // last commit with the native app and its screenshots
const SERVER = "http://127.0.0.1:8017/";
const SIZE = [1310, 850]; // the native screenshots' size

// name -> hash route with the state the native capture used (profile N, tab, view, unsaved change, held left button + scroll)
const SHOTS = {
  hits: "#/hits?dirty=1&press=1",
  "hits-rapid": "#/hits?profile=2&tab=rt&press=1",
  "hits-presets": "#/hits?tab=presets&press=1",
  buttons: "#/buttons?profile=4&view=side&press=1",
  sensor: "#/sensor?profile=3",
  profiles: "#/profiles?dirty=1",
  device: "#/device",
};

const BROWSERS = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

async function serverUp() {
  try {
    return (await fetch(SERVER)).ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return null;
  const child = spawn(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js")], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await serverUp()) return child;
  }
  child.kill();
  throw new Error("the dev server did not start (npm install first?)");
}

function nativePng(name) {
  return execFileSync("git", ["show", `${NATIVE_COMMIT}:docs/screenshots/${name}.png`], { cwd: ROOT, maxBuffer: 1 << 26 });
}

function webShot(browser, name, route) {
  const file = join(OUT, `web-${name}.png`);
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--force-device-scale-factor=1", `--window-size=${SIZE.join(",")}`, "--virtual-time-budget=6000",
    `--user-data-dir=${join(OUT, "chrome-profile")}`, `--screenshot=${file}`, `${SERVER}?demo${route}`,
  ], { stdio: "ignore", timeout: 60_000 });
  return file;
}

function report(names) {
  const rows = names.map((n) => `
<section id="${n}">
  <h2>${n} <a href="${SERVER}?demo${SHOTS[n]}" target="_blank">open live</a></h2>
  <div class="pair">
    <figure><figcaption>Native (${NATIVE_COMMIT})</figcaption><img src="native-${n}.png"></figure>
    <figure><figcaption>Web</figcaption><img src="web-${n}.png"></figure>
  </div>
  <figure class="stack"><figcaption>Overlay / difference</figcaption>
    <div class="layers"><img src="native-${n}.png"><img class="top" src="web-${n}.png"></div>
  </figure>
</section>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Native vs web</title>
<style>
body{background:#1b1b1f;color:#ddd;font:14px system-ui;margin:0;padding:16px 24px}
header{position:sticky;top:0;background:#1b1b1f;padding:8px 0;z-index:2;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
a{color:#6cb6ff} h2{font-size:15px;margin:28px 0 8px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px} figure{margin:0} figcaption{opacity:.7;margin-bottom:4px}
img{width:100%;display:block;border:1px solid #333}
.stack{margin-top:12px;max-width:50%}.layers{position:relative}.layers .top{position:absolute;inset:0;opacity:var(--o,.5);mix-blend-mode:var(--m,normal)}
</style>
<header><b>Native vs web</b>${names.map((n) => `<a href="#${n}">${n}</a>`).join("")}
<label>Overlay mode <select onchange="document.body.style.setProperty('--m',this.value)"><option value="normal">opacity</option><option value="difference">difference</option></select></label>
<label>Web opacity <input type="range" min="0" max="1" step="0.05" value="0.5" oninput="document.body.style.setProperty('--o',this.value)"></label></header>
${rows}`;
}

const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(SHOTS);
for (const n of names) if (!SHOTS[n]) throw new Error(`unknown shot "${n}". Known: ${Object.keys(SHOTS).join(", ")}`);
const browser = BROWSERS.find((b) => existsSync(b));
if (!browser) throw new Error("no Chrome or Edge found; set CHROME=/path/to/chrome");
mkdirSync(OUT, { recursive: true });
const server = await ensureServer();
try {
  for (const n of names) {
    writeFileSync(join(OUT, `native-${n}.png`), nativePng(n));
    webShot(browser, n, SHOTS[n]);
    console.log(`  ${n}`);
  }
} finally {
  server?.kill();
}
writeFileSync(join(OUT, "report.html"), report(names));
console.log(`Report: ${join(OUT, "report.html")}`);
