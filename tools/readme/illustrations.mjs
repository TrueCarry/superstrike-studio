// Renders the README illustrations (tools/readme/scenes.html, on the app's src/mouse_*.svg) frame by frame in headless Chrome and
// writes them as looping GIFs to docs/illustrations/.
//   node tools/readme/illustrations.mjs [scene ...]      (default: every scene)
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, findBrowser } from "../parity/chrome.mjs";
import { encodeGif } from "./gif.mjs";

const OUT = join(ROOT, "docs/illustrations");
const FPS = 25;
const PORT = 9333;

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = pages.find((p) => p.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("headless Chrome did not start");
}

function session(url) {
  const ws = new WebSocket(url);
  const waiting = new Map();
  let id = 0;
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    msg.error ? w.reject(new Error(msg.error.message)) : w.resolve(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      waiting.set(++id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  return new Promise((resolve) => (ws.onopen = () => resolve({ evaluate, close: () => ws.close() })));
}

const profile = mkdtempSync(join(tmpdir(), "ss-illustrations-"));
const page = pathToFileURL(join(ROOT, "tools/readme/scenes.html")).href;
const chrome = spawn(findBrowser(), [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--force-device-scale-factor=1",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, page,
], { stdio: "ignore" });
try {
  const cdp = await session(await connect());
  while (!(await cdp.evaluate("typeof window.render === 'function'"))) await new Promise((r) => setTimeout(r, 100));
  const icons = Object.fromEntries([...readFileSync(join(ROOT, "src/components/icons.tsx"), "utf8").matchAll(/^\s+(\w+): "(M[^"]+)"/gm)].map((m) => [m[1], m[2]]));
  await cdp.evaluate(`Object.assign(ICONS, ${JSON.stringify(icons)})`);
  for (const view of ["top", "side"])
    await cdp.evaluate(`load("${view}", ${JSON.stringify(readFileSync(join(ROOT, `src/mouse_${view}.svg`), "utf8"))})`);
  const scenes = await cdp.evaluate("window.scenes");
  const picked = process.argv.slice(2);
  for (const n of picked) if (!scenes[n]) throw new Error(`unknown scene "${n}". Known: ${Object.keys(scenes).join(", ")}`);
  mkdirSync(OUT, { recursive: true });
  for (const name of picked.length ? picked : Object.keys(scenes)) {
    const { duration, size: [W, H] } = scenes[name];
    const count = Math.round(duration * FPS);
    const frames = [];
    for (let i = 0; i < count; i++) {
      const b64 = await cdp.evaluate(`render(${JSON.stringify(name)}, ${i / FPS})`);
      frames.push({ width: W, height: H, data: Buffer.from(b64, "base64") });
    }
    const gif = encodeGif(frames, frames.map(() => 1000 / FPS));
    writeFileSync(join(OUT, `${name}.gif`), gif);
    console.log(`  ${name}.gif  ${count} frames, ${(gif.length / 1024).toFixed(0)} KB`);
  }
  cdp.close();
} finally {
  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
