// The mouse drawings (src/mouse_top.svg, src/mouse_side.svg) as canvas paths, shared by the mouse
// picture (MouseView) and the illustrations.
import sideSvg from "../mouse_side.svg?raw";
import topSvg from "../mouse_top.svg?raw";

export type View = "top" | "side";

export interface Part {
  kind: "body" | "wheel" | "line" | "brand" | "zone";
  id: string;
  width: number; // stroke width of lines
  path: Path2D;
}
export interface ZoneGeo {
  path: Path2D;
  cx: number; // centroid, top and bottom, in drawing units
  cy: number;
  top: number;
  bottom: number;
  ok: boolean;
}
export interface Picture {
  w: number;
  h: number;
  parts: Part[];
  zones: Map<string, ZoneGeo>; // the button zones and "wheel"
}

const attr = (s: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(s)?.[1] ?? "";

function parse(svg: string): Picture {
  const [, w, h] = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg) ?? ["", "510", "993"];
  const parts: Part[] = [];
  const groups: string[] = [];
  for (const m of svg.matchAll(/<g\b([^>]*)>|<\/g>|<path\b([^>]*?)\/?>/g)) {
    if (m[0] === "</g>") groups.pop();
    else if (m[1] !== undefined) groups.push(attr(m[1], "id"));
    else {
      const a = m[2], cls = attr(a, "class"), id = attr(a, "id");
      const kind: Part["kind"] = cls.includes("zone") ? "zone" : cls.includes("body") ? "body" : cls.includes("wheel") ? "wheel"
        : cls.includes("line") ? "line" : groups.includes("brand") ? "brand" : "line";
      const width = cls.includes("bold") ? 7 : cls.includes("thin") ? 2.4 : 4;
      parts.push({ kind, id, width, path: new Path2D(attr(a, "d")) });
    }
  }
  const pic: Picture = { w: +w, h: +h, parts, zones: new Map() };
  for (const p of parts) if (p.kind === "zone" || p.kind === "wheel") pic.zones.set(p.kind === "wheel" ? "wheel" : p.id, geometry(pic, p.path));
  return pic;
}

/** Centroid, top and bottom of a zone, sampled every 3 drawing units like build_mask(). */
function geometry(pic: Picture, path: Path2D): ZoneGeo {
  const c = document.createElement("canvas");
  c.width = Math.ceil(pic.w);
  c.height = Math.ceil(pic.h);
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fill(path);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  let sx = 0, sy = 0, n = 0, top = 0, bottom = 0;
  for (let y = 0; y < c.height; y += 3)
    for (let x = 0; x < c.width; x += 3)
      if (data[(y * c.width + x) * 4 + 3] > 100) {
        if (!n) top = y;
        bottom = y;
        sx += x, sy += y, n++;
      }
  return { path, cx: n ? sx / n : 0, cy: n ? sy / n : 0, top, bottom, ok: n > 0 };
}

const cache: Partial<Record<View, Picture>> = {};
export const picture = (v: View) => (cache[v] ??= parse(v === "top" ? topSvg : sideSvg));

/** The plain drawing (body, wheel, brand, lines) in drawing units under the current transform. */
export function outline(g: CanvasRenderingContext2D, pic: Picture, shell = "#ffffff") {
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const p of pic.parts) {
    if (p.kind === "body") (g.fillStyle = shell), g.fill(p.path);
    else if (p.kind === "wheel") (g.fillStyle = "#6e6e75"), g.fill(p.path);
    else if (p.kind === "brand") (g.fillStyle = "#9c9ca3"), g.fill(p.path);
    else if (p.kind === "line") (g.strokeStyle = "#16161a"), (g.lineWidth = p.width), g.stroke(p.path);
  }
}
