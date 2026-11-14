// Decodes a GIF written by gif.mjs and saves chosen frames as PNG, to check the clips by eye.
//   node tools/readme/gifcheck.mjs docs/illustrations/actuation.gif [frame ...]   (default: first, middle, last)
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { encodePng } from "../parity/png.mjs";

function decodeGif(buf) {
  const w = buf.readUInt16LE(6), h = buf.readUInt16LE(8);
  const flags = buf[10];
  let o = 13;
  const pal = flags & 0x80 ? buf.subarray(o, (o += 3 * (1 << ((flags & 7) + 1)))) : null;
  const canvas = Buffer.alloc(w * h * 4, 255);
  const frames = [];
  while (o < buf.length) {
    const b = buf[o++];
    if (b === 0x3b) break;
    if (b === 0x21) {
      o++;
      while (buf[o]) o += buf[o] + 1;
      o++;
      continue;
    }
    const x = buf.readUInt16LE(o), y = buf.readUInt16LE(o + 2), fw = buf.readUInt16LE(o + 4), fh = buf.readUInt16LE(o + 6);
    o += 9;
    const min = buf[o++];
    const data = [];
    while (buf[o]) data.push(...buf.subarray(o + 1, o + 1 + buf[o])), (o += buf[o] + 1);
    o++;
    const px = lzw(Uint8Array.from(data), min, fw * fh);
    for (let i = 0; i < px.length; i++) {
      const p = ((y + Math.floor(i / fw)) * w + x + (i % fw)) * 4;
      canvas.set([pal[px[i] * 3], pal[px[i] * 3 + 1], pal[px[i] * 3 + 2], 255], p);
    }
    frames.push(Buffer.from(canvas));
  }
  return { w, h, frames };
}

function lzw(data, min, n) {
  const clear = 1 << min, end = clear + 1;
  let size = min + 1, dict = [], prev = null;
  const reset = () => ((dict = Array.from({ length: end + 1 }, (_, i) => (i < clear ? [i] : []))), (size = min + 1), (prev = null));
  reset();
  const out = [];
  let bit = 0;
  while (out.length < n) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === clear) { reset(); continue; }
    if (code === end) break;
    const entry = code < dict.length ? dict[code] : [...dict[prev], dict[prev][0]];
    out.push(...entry);
    if (prev !== null && dict.length < 4096) dict.push([...dict[prev], entry[0]]);
    if (dict.length === 1 << size && size < 12) size++;
    prev = code;
  }
  return out;
}

const [file, ...picks] = process.argv.slice(2);
const { w, h, frames } = decodeGif(readFileSync(file));
const which = picks.length ? picks.map(Number) : [0, frames.length >> 1, frames.length - 1];
for (const i of which) {
  const out = join("tools/parity/out", `${basename(file, ".gif")}-${i}.png`);
  writeFileSync(out, encodePng({ width: w, height: h, data: frames[i] }));
  console.log(out);
}
console.log(`${frames.length} frames, ${w}x${h}`);
