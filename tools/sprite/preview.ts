/*
 * Sprite workshop — renderers. Nearest-neighbor PNG previews (single frame or a
 * full sequence strip) and an animated GIF that plays the REAL sequence holds.
 * Both encoders are dependency-free (node:zlib for PNG deflate).
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { W, H, type Palette } from "./grid";

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* ---------------------------------- PNG ---------------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA buffer (w×h×4) as PNG. */
function encodePng(w: number, h: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Rasterize one frame to RGBA at an integer scale over a background color. */
function rasterize(frame: number[], palette: Palette, scale: number, bg: string): Buffer {
  const [br, bgc, bb] = hexToRgb(bg);
  const rgb: (RGB | null)[] = palette.map((c) => (c ? hexToRgb(c) : null));
  const w = W * scale;
  const h = H * scale;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = frame[Math.floor(y / scale) * W + Math.floor(x / scale)];
      const c = rgb[v];
      const o = (y * w + x) * 4;
      out[o] = c ? c[0] : br;
      out[o + 1] = c ? c[1] : bgc;
      out[o + 2] = c ? c[2] : bb;
      out[o + 3] = 255;
    }
  }
  return out;
}

export function framePng(
  path: string,
  frame: number[],
  palette: Palette,
  scale = 8,
  bg = "#efe7dc"
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(W * scale, H * scale, rasterize(frame, palette, scale, bg)));
}

/** All frames side by side with a gap — the sequence strip for review. */
export function stripPng(
  path: string,
  frames: number[][],
  palette: Palette,
  scale = 8,
  bg = "#efe7dc",
  gap = 2
): void {
  const fw = W * scale;
  const fh = H * scale;
  const gapPx = gap * scale;
  const w = frames.length * fw + (frames.length - 1) * gapPx;
  const [br, bgc, bb] = hexToRgb(bg);
  const out = Buffer.alloc(w * fh * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i] = br;
    out[i + 1] = bgc;
    out[i + 2] = bb;
    out[i + 3] = 255;
  }
  frames.forEach((frame, fi) => {
    const raster = rasterize(frame, palette, scale, bg);
    const xOff = fi * (fw + gapPx);
    for (let y = 0; y < fh; y++) {
      raster.copy(out, (y * w + xOff) * 4, y * fw * 4, (y + 1) * fw * 4);
    }
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, encodePng(w, fh, out));
}

/* ---------------------------------- GIF ---------------------------------- */

/** GIF LZW compressor (standard variable-width codes, LSB-first packing). */
function lzw(minCodeSize: number, pixels: Uint8Array): Buffer {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let next = eoi + 1;
  let size = minCodeSize + 1;
  let dict = new Map<string, number>();
  const bytes: number[] = [];
  let cur = 0;
  let bits = 0;
  const emit = (code: number) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) {
      bytes.push(cur & 0xff);
      cur >>= 8;
      bits -= 8;
    }
  };
  const reset = () => {
    dict = new Map();
    for (let i = 0; i < clear; i++) dict.set(String(i), i);
    next = eoi + 1;
    size = minCodeSize + 1;
  };

  reset();
  emit(clear);
  let prefix = String(pixels[0]);
  for (let i = 1; i < pixels.length; i++) {
    const k = String(pixels[i]);
    const joined = `${prefix},${k}`;
    if (dict.has(joined)) {
      prefix = joined;
    } else {
      emit(dict.get(prefix)!);
      dict.set(joined, next++);
      if (next - 1 === 1 << size && size < 12) size++;
      else if (next - 1 > 4095) {
        emit(clear);
        reset();
      }
      prefix = k;
    }
  }
  emit(dict.get(prefix)!);
  emit(eoi);
  if (bits > 0) bytes.push(cur & 0xff);
  return Buffer.from(bytes);
}

/** Animated GIF playing `sequence` with its real holds, looping forever. */
export function sequenceGif(
  path: string,
  frames: number[][],
  sequence: { frame: number; ms: number }[],
  palette: Palette,
  scale = 8,
  bg = "#efe7dc"
): void {
  const w = W * scale;
  const h = H * scale;
  // Global color table: slot 0 = background (palette[0] is transparent), then
  // the sprite colors, padded to 8 entries.
  const table: RGB[] = [hexToRgb(bg)];
  for (const c of palette.slice(1)) table.push(hexToRgb(c ?? bg));
  while (table.length < 8) table.push([0, 0, 0]);

  const parts: Buffer[] = [];
  parts.push(Buffer.from("GIF89a", "ascii"));
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0);
  lsd.writeUInt16LE(h, 2);
  lsd[4] = 0xf2; // GCT present, 8-bit color res, GCT size 8
  parts.push(lsd);
  parts.push(Buffer.from(table.slice(0, 8).flat()));
  parts.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0", "ascii"), 3, 1, 0, 0, 0]));

  for (const step of sequence) {
    const gce = Buffer.alloc(8);
    gce[0] = 0x21;
    gce[1] = 0xf9;
    gce[2] = 4;
    gce[3] = 0; // no transparency, no disposal
    gce.writeUInt16LE(Math.max(2, Math.round(step.ms / 10)), 4);
    parts.push(gce);
    const desc = Buffer.alloc(10);
    desc[0] = 0x2c;
    desc.writeUInt16LE(w, 5);
    desc.writeUInt16LE(h, 7);
    parts.push(desc);

    const frame = frames[step.frame];
    const px = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        px[y * w + x] = frame[Math.floor(y / scale) * W + Math.floor(x / scale)];
      }
    }
    parts.push(Buffer.from([3])); // LZW min code size (8 colors)
    const data = lzw(3, px);
    for (let i = 0; i < data.length; i += 255) {
      const block = data.subarray(i, i + 255);
      parts.push(Buffer.from([block.length]), block);
    }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat(parts));
}
