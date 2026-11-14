// Minimal animated GIF encoder for the README clips: one shared 256-colour palette (median cut over
// all frames), each frame stores only the rectangle that changed, LZW as in GIF89a. No dependencies.

/** frames: [{ width, height, data: RGBA bytes }] all the same size; delays in ms (one per frame). */
export function encodeGif(frames, delays) {
  const { width: w, height: h } = frames[0];
  const palette = buildPalette(frames, 256);
  const lookup = paletteLookup(palette);
  const out = [];
  const bytes = (...b) => out.push(Buffer.from(b));
  const u16 = (n) => [n & 255, (n >> 8) & 255];

  out.push(Buffer.from("GIF89a", "ascii"));
  bytes(...u16(w), ...u16(h), 0xf7, 0, 0); // global table, 8 bits, 256 entries
  const table = Buffer.alloc(256 * 3);
  palette.forEach((c, i) => table.set(c, i * 3));
  out.push(table);
  bytes(0x21, 0xff, 11, ..."NETSCAPE2.0".split("").map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0); // loop forever

  let prev = null;
  for (let f = 0; f < frames.length; f++) {
    const idx = indexFrame(frames[f], lookup);
    let box = { x: 0, y: 0, w, h };
    if (prev) box = changedBox(prev, idx, w, h) ?? { x: 0, y: 0, w: 1, h: 1 };
    prev = idx;
    const delay = Math.max(2, Math.round((delays[f] ?? 100) / 10));
    bytes(0x21, 0xf9, 4, 0x04, ...u16(delay), 0, 0); // graphic control: keep the previous frame below
    bytes(0x2c, ...u16(box.x), ...u16(box.y), ...u16(box.w), ...u16(box.h), 0);
    const sub = new Uint8Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) sub.set(idx.subarray((box.y + y) * w + box.x, (box.y + y) * w + box.x + box.w), y * box.w);
    out.push(Buffer.from([8]), lzwBlocks(sub));
  }
  bytes(0x3b);
  return Buffer.concat(out);
}

function changedBox(a, b, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (a[y * w + x] !== b[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// ---------------------------------------------------------------- palette

function buildPalette(frames, size) {
  const hist = new Map(); // 5 bits per channel -> count
  for (const fr of frames)
    for (let i = 0; i < fr.data.length; i += 4) {
      const k = ((fr.data[i] >> 3) << 10) | ((fr.data[i + 1] >> 3) << 5) | (fr.data[i + 2] >> 3);
      hist.set(k, (hist.get(k) ?? 0) + 1);
    }
  const colours = [...hist].map(([k, n]) => ({ c: [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4], n }));
  let boxes = [colours];
  while (boxes.length < size) {
    let best = -1, bestScore = 0, bestCh = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0, n = 0;
        for (const e of b) (lo = Math.min(lo, e.c[ch])), (hi = Math.max(hi, e.c[ch])), (n += e.n);
        const score = (hi - lo) * Math.sqrt(n);
        if (score > bestScore) (bestScore = score), (best = i), (bestCh = ch);
      }
    });
    if (best < 0) break;
    const b = boxes[best].sort((p, q) => p.c[bestCh] - q.c[bestCh]);
    const total = b.reduce((s, e) => s + e.n, 0);
    let acc = 0, cut = 1;
    for (; cut < b.length - 1; cut++) if ((acc += b[cut - 1].n) >= total / 2) break;
    boxes.splice(best, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = boxes.map((b) => {
    const n = b.reduce((s, e) => s + e.n, 0);
    return [0, 1, 2].map((ch) => Math.round(b.reduce((s, e) => s + e.c[ch] * e.n, 0) / n));
  });
  while (pal.length < size) pal.push([0, 0, 0]);
  return pal;
}

function paletteLookup(pal) {
  const cache = new Map();
  return (r, g, b) => {
    const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = cache.get(k);
    if (v === undefined) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < pal.length; i++) {
        const dr = pal[i][0] - r, dg = pal[i][1] - g, db = pal[i][2] - b;
        const d = 3 * dr * dr + 4 * dg * dg + 2 * db * db;
        if (d < bd) (bd = d), (best = i);
      }
      cache.set(k, (v = best));
    }
    return v;
  };
}

function indexFrame(fr, lookup) {
  const idx = new Uint8Array(fr.width * fr.height);
  for (let i = 0, p = 0; p < idx.length; i += 4, p++) idx[p] = lookup(fr.data[i], fr.data[i + 1], fr.data[i + 2]);
  return idx;
}

// ---------------------------------------------------------------- LZW

function lzwBlocks(pixels) {
  const CLEAR = 256, END = 257;
  const out = [];
  let cur = 0, bits = 0, size = 9;
  const emit = (code) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) out.push(cur & 255), (cur >>>= 8), (bits -= 8);
  };
  let dict = new Map(), next = 258;
  emit(CLEAR);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const key = (prefix << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else {
      emit(CLEAR);
      dict = new Map();
      next = 258;
      size = 9;
    }
    prefix = k;
  }
  emit(prefix);
  emit(END);
  if (bits > 0) out.push(cur & 255);
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) {
    const part = out.slice(i, i + 255);
    blocks.push(part.length, ...part);
  }
  blocks.push(0);
  return Buffer.from(blocks);
}
