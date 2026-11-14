// Design review shots: renders the app with the demo mouse in headless Chrome, in each panel and a few
// states (unsaved change, held button, other languages, right-to-left, narrow window, reduced motion),
// and writes tools/parity/out/report.html with all of them.
//   node tools/parity/shots.mjs [name ...]      (default: every shot)
// Uses the dev server on 127.0.0.1:8017 when it runs, otherwise starts one. No extra packages.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SERVER, ensureServer, findBrowser } from "./chrome.mjs";

const OUT = join(ROOT, "tools/parity/out");
const WIDE = [1440, 900], NARROW = [420, 900];

// name -> [query and hash route (profile N, tab, view, unsaved change, held left button + scroll), window size, extra flags]
const SHOTS = {
  connect: ["#/click", WIDE, [], ""],
  click: ["#/click?dirty=1&press=1", WIDE],
  aim: ["#/aim?profile=3", WIDE],
  buttons: ["#/buttons?profile=4&press=1", WIDE],
  profiles: ["#/profiles?dirty=1", WIDE],
  device: ["#/device", WIDE],
  "lang-ja": ["&lang=ja#/profiles?dirty=1", WIDE],
  "lang-ar": ["&lang=ar#/aim?profile=3", WIDE],
  "lang-ur": ["&lang=ur#/click", WIDE],
  narrow: ["#/click", NARROW],
  "reduced-motion": ["#/aim", WIDE, ["--force-prefers-reduced-motion"]],
};
// the connect screen is the app without ?demo
const url = (n) => `${SERVER}?${SHOTS[n][3] ?? "demo&shot"}${SHOTS[n][0]}`;

function shot(browser, name) {
  const [, size, flags = []] = SHOTS[name];
  execFileSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--force-device-scale-factor=1", `--window-size=${size.join(",")}`, "--virtual-time-budget=6000", ...flags,
    `--user-data-dir=${join(OUT, "chrome-profile")}`, `--screenshot=${join(OUT, `${name}.png`)}`, url(name),
  ], { stdio: "ignore", timeout: 60_000 });
}

function report(names) {
  const rows = names.map((n) => `
<section id="${n}">
  <h2>${n} <a href="${url(n)}" target="_blank">open live</a></h2>
  <img src="${n}.png" style="max-width:${SHOTS[n][1][0]}px">
</section>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Design review</title>
<style>
body{background:#1b1b1f;color:#ddd;font:14px system-ui;margin:0;padding:16px 24px}
header{position:sticky;top:0;background:#1b1b1f;padding:8px 0;z-index:2;display:flex;gap:16px;flex-wrap:wrap}
a{color:#6cb6ff} h2{font-size:15px;margin:28px 0 8px} img{width:100%;display:block;border:1px solid #333}
</style>
<header><b>Design review</b>${names.map((n) => `<a href="#${n}">${n}</a>`).join("")}</header>
${rows}`;
}

const picked = process.argv.slice(2);
const names = picked.length ? picked : Object.keys(SHOTS);
for (const n of names) if (!SHOTS[n]) throw new Error(`unknown shot "${n}". Known: ${Object.keys(SHOTS).join(", ")}`);
const browser = findBrowser();
mkdirSync(OUT, { recursive: true });
const server = await ensureServer();
try {
  for (const n of names) {
    shot(browser, n);
    console.log(`  ${n}`);
  }
} finally {
  server?.kill();
}
writeFileSync(join(OUT, "report.html"), report(names));
console.log(`Report: ${join(OUT, "report.html")}`);
