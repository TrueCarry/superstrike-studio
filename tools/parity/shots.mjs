// Design review shots: renders the app with the demo mouse in headless Chrome, in each panel and a few
// states (unsaved change, held button, other languages, right-to-left, narrow window, reduced motion),
// and writes tools/parity/out/report.html with all of them.
//   node tools/parity/shots.mjs [name ...]      (default: every shot)
// Uses the dev server on 127.0.0.1:8017 when it runs, otherwise starts one. No extra packages.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, SERVER, ensureServer, headless } from "./chrome.mjs";

const OUT = join(ROOT, "tools/parity/out");
const WIDE = [1440, 900], FULL = [1920, 1080], NARROW = [420, 900];

// name -> { route: query and hash (profile N, tab, view, unsaved change, held left button + scroll), size, query, motion, run }
const SHOTS = {
  connect: { route: "#/click", query: "" },
  click: { route: "#/click?dirty=1&press=1" },
  aim: { route: "#/aim?profile=3" },
  "aim-end": { route: "#/aim?profile=3", run: "document.querySelector('.panel').scrollTop = 1e6" },
  buttons: { route: "#/buttons?profile=4&press=1" },
  "buttons-end": { route: "#/buttons?profile=4", run: "document.querySelector('.panel').scrollTop = 1e6" },
  profiles: { route: "#/profiles?dirty=1" },
  "profiles-end": { route: "#/profiles", run: "document.querySelector('.panel').scrollTop = 1e6" },
  device: { route: "#/device" },
  "device-end": { route: "#/device", run: "document.querySelector('.panel').scrollTop = 1e6" },
  "full-hd": { route: "#/aim", size: FULL },
  // the device chip: the mouse says hello (caught mid-hop) and its card opens
  "mouse-card": { route: "#/click", run: `(async () => {
    for (let i = 0; i < 40; i++) document.body.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", screenX: 300 + i * 25, screenY: 400, bubbles: true }));
    for (let i = 0; i < 7; i++) document.body.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: -1, bubbles: true }));
    document.querySelector('.device-chip').click();
    await new Promise((r) => setTimeout(r, 170));
  })()`, wait: 0 },
  "test-clicks": { route: "#/click", run: "document.querySelector('.stage-foot .switch input')?.click()" },
  "click-right": { route: "#/click", run: "document.querySelectorAll('.panel .segments button')[1]?.click()" },
  "lang-ja": { route: "&lang=ja#/profiles?dirty=1" },
  "lang-ar": { route: "&lang=ar#/aim?profile=3" },
  "lang-ur": { route: "&lang=ur#/click" },
  narrow: { route: "#/click", size: NARROW },
  "reduced-motion": { route: "#/aim", motion: "reduce" },
  "setup-speed": { route: "#/profiles", run: `(async () => {
    document.querySelector('.panel-head .suggested').click(); await new Promise((r) => setTimeout(r, 200));
    document.querySelector('.setup-choice').click(); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.setup footer .suggested').click(); await new Promise((r) => setTimeout(r, 200));
    document.querySelectorAll('.setup [role=radio]')[2].click();
  })()` },
  "setup-save": { route: "#/profiles", run: `(async () => {
    document.querySelector('.panel-head .suggested').click(); await new Promise((r) => setTimeout(r, 200));
    document.querySelector('.setup-choice').click(); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.setup footer .suggested').click(); await new Promise((r) => setTimeout(r, 200));
    document.querySelectorAll('.setup [role=radio]')[2].click(); await new Promise((r) => setTimeout(r, 100)); document.querySelector('.setup footer .suggested').click();
  })()` },
  // the newer scenes at a few moments of their loop, side by side
  scenes: { route: "#/click", size: [1600, 1100], run: `(async () => {
    const { SCENES } = await import("/src/illustrations/index.ts");
    const rows = [["speed", { dpi: 1600, marks: [800, 1600, 3200] }], ["surface", { mode: 0 }], ["surface", { mode: 2 }], ["scroll", { ms: 100 }], ["power", { low: 60, sleep: 300 }], ["save", { act: 3, dpi: 1600, hap: 2 }]];
    document.body.innerHTML = "";
    document.body.style.cssText = "overflow:auto;background:#111;display:grid;grid-template-columns:repeat(5,1fr);gap:4px";
    for (const [name, v] of rows) {
      const sc = SCENES[name];
      if (!sc) continue;
      const [w, h] = sc.size(v);
      for (const k of [0.15, 0.35, 0.55, 0.75, 0.95]) {
        const c = document.createElement("canvas");
        c.width = w; c.height = h; c.style.width = "100%";
        sc.draw(c.getContext("2d"), sc.duration * k, v, w, h);
        document.body.append(c);
      }
    }
  })()` },
};
// the connect screen is the app without ?demo
const url = (n) => `${SERVER}?${SHOTS[n].query ?? "demo&shot"}${SHOTS[n].route}`;
const sizeOf = (n) => SHOTS[n].size ?? WIDE;

async function shot(page, name) {
  const [width, height] = sizeOf(name), s = SHOTS[name];
  await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: s.motion ?? "" }] });
  await page.send("Page.navigate", { url: "about:blank" }); // a fresh load even when only the hash differs
  await page.send("Page.navigate", { url: url(name) });
  await new Promise((r) => setTimeout(r, 2500));
  if (s.run) (await page.evaluate(s.run), await new Promise((r) => setTimeout(r, s.wait ?? 800)));
  const { data } = await page.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, "base64"));
}

function report(names) {
  const rows = names.map((n) => `
<section id="${n}">
  <h2>${n} <a href="${url(n)}" target="_blank">open live</a></h2>
  <img src="${n}.png" style="max-width:${sizeOf(n)[0]}px">
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
mkdirSync(OUT, { recursive: true });
const server = await ensureServer();
const page = await headless("about:blank", { port: 9335 });
try {
  for (const n of names) {
    await shot(page, n);
    console.log(`  ${n}`);
  }
} finally {
  await page.close();
  server?.kill();
}
writeFileSync(join(OUT, "report.html"), report(names));
console.log(`Report: ${join(OUT, "report.html")}`);
