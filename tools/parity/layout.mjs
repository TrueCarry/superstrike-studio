// Layout check: opens every tab with the demo mouse at a few desktop sizes and reports elements that
// stick out of the window or the panel, the mouse picture moving between tabs, and anything moving when
// an unsaved change appears. Exits with 1 when it finds something.
//   node tools/parity/layout.mjs
import { SERVER, ensureServer, headless } from "./chrome.mjs";

const SIZES = [[1280, 800], [1440, 900], [1920, 1080]];
const TABS = ["click", "aim", "buttons", "profiles", "device"];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page: boxes of the mouse and the panel, and elements wider than their container.
const MEASURE = `(() => {
  const box = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); };
  const panel = document.querySelector(".panel"), pr = panel?.getBoundingClientRect();
  const out = [];
  for (const e of document.querySelectorAll(".app *")) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest(".popover, .toasts, .savebar-wrap")) continue;
    const name = e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\\s+/).join(".") : "");
    if (r.right > innerWidth + 1 || r.left < -1) out.push("outside the window: " + name);
    else if (pr && panel.contains(e) && (r.right > pr.right + 1 || r.left < pr.left - 1)) out.push("outside the panel: " + name);
  }
  const mv = document.querySelector(".stage-mouse .mouseview"), fit = mv?.querySelector("canvas")?.dataset.fit;
  return { mouse: [...(box(".stage-mouse .mouseview") ?? []), fit].join(" "), panel: box(".panel"), over: [...new Set(out)].slice(0, 8) };
})()`;

const server = await ensureServer();
let problems = 0;
const report = (where, what) => (problems++, console.log(`  ${where}: ${what}`));
try {
  for (const [w, h] of SIZES) {
    const page = await headless(`${SERVER}?demo&shot#/click`, { flags: [`--window-size=${w},${h}`] });
    try {
      await page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      for (let i = 0; i < 40 && !(await page.evaluate("!!document.querySelector('.panel')")); i++) await wait(250);
      let first = null;
      for (const tab of TABS) {
        await page.evaluate(`location.hash = "#/${tab}"`);
        await wait(700);
        const m = await page.evaluate(MEASURE);
        const where = `${w}x${h} ${tab}`;
        for (const o of m.over) report(where, o);
        if (!first) first = m;
        else {
          if (JSON.stringify(m.mouse) !== JSON.stringify(first.mouse)) report(where, `mouse at ${m.mouse} instead of ${first.mouse}`);
          if (JSON.stringify(m.panel) !== JSON.stringify(first.panel)) report(where, `panel at ${m.panel} instead of ${first.panel}`);
        }
      }
      // an unsaved change must not move anything
      await page.evaluate(`location.hash = "#/aim"`);
      await wait(500);
      const before = await page.evaluate(MEASURE);
      await page.evaluate(`__superstrike.updateProfile((p) => (p.angleSnap = p.angleSnap ? 0 : 1))`);
      await wait(600);
      const after = await page.evaluate(MEASURE);
      if (JSON.stringify(before.mouse) !== JSON.stringify(after.mouse) || JSON.stringify(before.panel) !== JSON.stringify(after.panel))
        report(`${w}x${h}`, `an unsaved change moves the layout (mouse ${before.mouse} -> ${after.mouse}, panel ${before.panel} -> ${after.panel})`);
    } finally {
      await page.close();
    }
  }
} finally {
  server?.kill();
}
console.log(problems ? `${problems} layout problems` : "Layout OK");
process.exit(problems ? 1 : 0);
