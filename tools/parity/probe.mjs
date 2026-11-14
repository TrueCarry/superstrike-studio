// Measures a screenshot: colours along a row or column, collapsed into runs, to read off sizes,
// edges and colours of the native app (its screenshots at 991cbfc) or of a design review shot.
//   node tools/parity/probe.mjs <native|web> <shot> row <y> [x0 x1]
//   node tools/parity/probe.mjs <native|web> <shot> col <x> [y0 y1]
//   node tools/parity/probe.mjs <native|web> <shot> at <x> <y>
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, pixel } from "./png.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [side, shot, mode, a, b, c] = process.argv.slice(2);
const buf = side === "native"
  ? execFileSync("git", ["show", `991cbfc:docs/screenshots/${shot}.png`], { cwd: ROOT, maxBuffer: 1 << 26 })
  : readFileSync(join(ROOT, "tools/parity/out", `${shot}.png`));
const img = decodePng(buf);
if (mode === "at") {
  console.log(pixel(img, +a, +b));
} else {
  const along = mode === "row" ? img.width : img.height;
  const from = b ? +b : 0, to = c ? +c : along - 1;
  let start = from, last = null;
  const runs = [];
  for (let i = from; i <= to + 1; i++) {
    const col = i <= to ? (mode === "row" ? pixel(img, i, +a) : pixel(img, +a, i)) : null;
    if (col !== last) {
      if (last) runs.push(`${start}-${i - 1} (${i - start}) ${last}`);
      start = i, last = col;
    }
  }
  console.log(`${img.width}x${img.height}  ${mode} ${a}:`);
  console.log(runs.filter((r) => !/\((1|2)\) /.test(r) || runs.length < 60).join("\n"));
}
