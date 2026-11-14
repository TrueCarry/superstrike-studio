// Screenshot parity report: renders the web app with the demo mouse in headless Chrome, in the same
// states as the native app's docs/screenshots (upstream tools/screenshots/capture.sh), and writes
// tools/parity/out/report.html with native and web side by side, overlaid, and as a difference.
//   node tools/parity/shots.mjs [name ...]      (default: every shot)
//   node tools/parity/shots.mjs --readme        (the README screenshots, into docs/screenshots/)
// Uses the dev server on 127.0.0.1:8017 when it runs, otherwise starts one. No extra packages.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SERVER, ensureServer, findBrowser } from "./chrome.mjs";

const OUT = join(ROOT, "tools/parity/out");
const NATIVE_COMMIT = "991cbfc"; // last commit with the native app and its screenshots
const SIZE = [1310, 850]; // the native screenshots' size

// name -> page query and hash route with the state the native capture used (language, profile N, tab,
// view, unsaved change, held left button + scroll)
const SHOTS = {
  hits: "#/hits?dirty=1&press=1",
  "hits-rapid": "#/hits?profile=2&tab=rt&press=1",
  "hits-presets": "#/hits?tab=presets&press=1",
  buttons: "#/buttons?profile=4&view=side&press=1",
  sensor: "#/sensor?profile=3",
  profiles: "#/profiles?dirty=1",
  device: "#/device",
  "lang-ja": "&lang=ja#/profiles?dirty=1",
  "lang-ar": "&lang=ar#/sensor?profile=3",
};
const url = (n) => `${SERVER}?demo${SHOTS[n]}`;

function nativePng(name) {
  return execFileSync("git", ["show", `${NATIVE_COMMIT}:docs/screenshots/${name}.png`], { cwd: ROOT, maxBuffer: 1 << 26 });
}

function webShot(browser, name) {
  const file = join(OUT, `web-${name}.png`);
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--force-device-scale-factor=1", `--window-size=${SIZE.join(",")}`, "--virtual-time-budget=6000",
    `--user-data-dir=${join(OUT, "chrome-profile")}`, `--screenshot=${file}`, url(name),
  ], { stdio: "ignore", timeout: 60_000 });
  return file;
}

function report(names) {
  const rows = names.map((n) => `
<section id="${n}">
  <h2>${n} <a href="${url(n)}" target="_blank">open live</a></h2>
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

const args = process.argv.slice(2);
const readme = args.includes("--readme");
const picked = args.filter((a) => a !== "--readme");
const names = picked.length ? picked : Object.keys(SHOTS);
for (const n of names) if (!SHOTS[n]) throw new Error(`unknown shot "${n}". Known: ${Object.keys(SHOTS).join(", ")}`);
const browser = findBrowser();
mkdirSync(OUT, { recursive: true });
const server = await ensureServer();
try {
  for (const n of names) {
    writeFileSync(join(OUT, `native-${n}.png`), nativePng(n));
    webShot(browser, n);
    console.log(`  ${n}`);
  }
} finally {
  server?.kill();
}
if (readme) {
  const docs = join(ROOT, "docs/screenshots");
  mkdirSync(docs, { recursive: true });
  for (const n of names) copyFileSync(join(OUT, `web-${n}.png`), join(docs, `${n}.png`));
  console.log(`README screenshots: ${docs}`);
}
writeFileSync(join(OUT, "report.html"), report(names));
console.log(`Report: ${join(OUT, "report.html")}`);
