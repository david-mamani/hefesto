/*
 * Assemble the official idle (breathing) clip from the designed keyframes in
 * src/idle-frames.json: validate against the §21 contract, print a surgical
 * diff report (what moves, frame to frame), render PNG/GIF previews, and export
 * public/mascot/idle.json with the proposed uneven holds.
 *
 *   npx tsx tools/sprite/build-idle.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertFrame, loadClipFile, saveClipFile, toAscii, type ClipFile } from "./grid";
import { diffFrames, summarize, changedRows } from "./diff";
import { framePng, stripPng, sequenceGif } from "./preview";

const ROOT = join(__dirname, "..", "..");
const OUT = join(__dirname, "out");

// Timing set by art direction: f0/f2 are quick 200ms settles, f1/f3 are the
// long 2s rest poses — a slow, calm cat breath.
const SEQUENCE = [
  { frame: 0, ms: 200 },
  { frame: 1, ms: 2000 },
  { frame: 2, ms: 200 },
  { frame: 3, ms: 2000 },
];

const raw = JSON.parse(
  readFileSync(join(__dirname, "src", "idle-frames.json"), "utf8")
) as ClipFile[];
const palette = raw[0].palette;
const frames = raw.map((r, i) => {
  if (!r.indices) throw new Error(`source frame ${i} has no indices`);
  assertFrame(r.indices, palette.length, `idle frame ${i}`);
  if (JSON.stringify(r.palette) !== JSON.stringify(palette)) {
    throw new Error(`frame ${i} palette differs from frame 0`);
  }
  return r.indices;
});
console.log(`— idle build: ${frames.length} frames validated (32×36, palette ok) —\n`);

const staticSprite = loadClipFile(join(ROOT, "public", "mascot", "hefesto-static.json"));

console.log("static → f0 (what the designed base changes vs the old static):");
console.log(summarize(diffFrames(staticSprite.indices!, frames[0])));

for (let i = 0; i < frames.length; i++) {
  const j = (i + 1) % frames.length;
  const d = diffFrames(frames[i], frames[j]);
  console.log(`\nf${i} → f${j}:`);
  console.log(summarize(d));
  console.log(`  changed rows: [${changedRows(d).join(", ")}]`);
}

console.log("\nf0 ASCII (rows 0-19, head zone):");
console.log(toAscii(frames[0], [0, 19]));

// Previews — read these before showing them.
frames.forEach((f, i) => framePng(join(OUT, `idle-f${i}.png`), f, palette, 8));
stripPng(join(OUT, "idle-strip.png"), frames, palette, 8);
sequenceGif(join(OUT, "idle.gif"), frames, SEQUENCE, palette, 8);
console.log(`\npreviews → tools/sprite/out/idle-strip.png · idle-f0..3.png · idle.gif`);

// Export the clip in the §21 contract shape.
const clip: ClipFile = {
  name: "idle",
  w: 32,
  h: 36,
  palette,
  frames,
  sequence: SEQUENCE,
  loop: true,
};
saveClipFile(join(ROOT, "public", "mascot", "idle.json"), clip);
console.log("exported → public/mascot/idle.json");
