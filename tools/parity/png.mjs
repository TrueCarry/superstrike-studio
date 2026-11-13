// Minimal PNG read / write (8-bit RGB or RGBA, not interlaced) with node:zlib, for the parity tools.
import { deflateSync, inflateSync } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** { width, height, data: RGBA bytes } */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let w = 0, h = 0, type = 0;
  const idat = [];
  for (let o = 8; o < buf.length; ) {
    const len = buf.readUInt32BE(o), kind = buf.toString("ascii", o + 4, o + 8), body = buf.subarray(o + 8, o + 8 + len);
    if (kind === "IHDR") {
      w = body.readUInt32BE(0), h = body.readUInt32BE(4), type = body[9];
      if (body[8] !== 8 || body[12] !== 0 || (type !== 2 && type !== 6)) throw new Error("unsupported PNG format");
    } else if (kind === "IDAT") idat.push(body);
    o += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride), data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  for (let i = 0; i < w * h; i++) {
    for (let k = 0; k < 3; k++) data[i * 4 + k] = px[i * bpp + k];
    data[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255;
  }
  return { width: w, height: h, data };
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function chunk(kind, body) {
  const out = Buffer.alloc(12 + body.length);
  out.writeUInt32BE(body.length, 0);
  out.write(kind, 4, "ascii");
  body.copy(out, 8);
  let c = -1;
  for (const b of out.subarray(4, 8 + body.length)) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  out.writeInt32BE(~c, 8 + body.length);
  return out;
}

export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0), ihdr.writeUInt32BE(height, 4), ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Share of pixels that differ visibly (0..1) and a picture with the differences in red over a dimmed native. */
export function diffPng(a, b, threshold = 40) {
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const out = { width: w, height: h, data: Buffer.alloc(w * h * 4) };
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4, o = (y * w + x) * 4;
      const d = Math.abs(a.data[i] - b.data[j]) + Math.abs(a.data[i + 1] - b.data[j + 1]) + Math.abs(a.data[i + 2] - b.data[j + 2]);
      const grey = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 9;
      if (d > threshold) n++, out.data.set([255, 40, 60, 255], o);
      else out.data.set([grey, grey, grey, 255], o);
    }
  return { score: n / (w * h), image: out };
}

export const pixel = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return "#" + [0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, "0")).join("");
};
