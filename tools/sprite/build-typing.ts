/*
 * Typing — "Focused…": Hefesto works on a laptop while writing a reply.
 * Sustained loop on idle frame 1 (head-up rest pose), anchored to it.
 *
 * The laptop lid (facing us) covers the lower body; the clip's palette gains
 * two grays for the prop — the cat's own colors never change. Motion: the
 * eyes drop to the screen and scan left ↔ right, like reading while writing.
 *
 *   npx tsx tools/sprite/build-typing.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setPixels, toAscii, saveClipFile, type ClipFile } from "./grid";
import { diffFrames, summarize } from "./diff";
import { stripPng, sequenceGif } from "./preview";

const ROOT = join(__dirname, "..", "..");
const OUT = join(__dirname, "out");
const src = JSON.parse(
  readFileSync(join(__dirname, "src", "idle-frames.json"), "utf8")
) as ClipFile[];
const rest = src[1].indices!;
// Prop palette: 5 = laptop gray, 6 = logo light gray. Cat colors untouched.
const palette = [...src[1].palette, "#9e9e9e", "#d4d4d4"];

// Laptop lid: rows 20-26 × cols 6-23, with a 2×2 light logo at the center.
const lid: [number, number, number][] = [];
for (let y = 20; y <= 26; y++) for (let x = 6; x <= 23; x++) lid.push([x, y, 5]);
for (const [x, y] of [[14, 22], [15, 22], [14, 23], [15, 23]] as const) lid.push([x, y, 6]);

const laptop = setPixels(rest, lid);

// Eyes drop to the screen: clear the rest pupils (rows 10-11), then scan.
const PUPILS_REST: [number, number][] = [
  [10, 10], [11, 10], [18, 10], [19, 10],
  [10, 11], [11, 11], [18, 11], [19, 11],
];
const cleared = setPixels(
  laptop,
  PUPILS_REST.map(([x, y]) => [x, y, 1] as [number, number, number])
);

// Down-gaze pupils (rows 11-12), scanning left and right inside the lenses.
const gaze = (dx: number) =>
  setPixels(cleared, ([
    [10 + dx, 11], [11 + dx, 11], [10 + dx, 12], [11 + dx, 12],
    [18 + dx, 11], [19 + dx, 11], [18 + dx, 12], [19 + dx, 12],
  ] as [number, number][]).map(([x, y]) => [x, y, 3] as [number, number, number]));

const scanLeft = gaze(-1);
const scanRight = gaze(1);

const SEQUENCE = [
  { frame: 0, ms: 380 },
  { frame: 1, ms: 380 },
];

console.log("rest → scanLeft:");
console.log(summarize(diffFrames(rest, scanLeft)));
console.log("\nscanLeft, eye zone (rows 8-14):");
console.log(toAscii(scanLeft, [8, 14]));

stripPng(join(OUT, "typing-strip.png"), [rest, scanLeft, scanRight], palette, 8);
sequenceGif(join(OUT, "typing.gif"), [rest, scanLeft, scanRight], [
  { frame: 0, ms: 900 },
  { frame: 1, ms: 380 },
  { frame: 2, ms: 380 },
  { frame: 1, ms: 380 },
  { frame: 2, ms: 380 },
], palette, 8);

const clip: ClipFile & { anchor: number } = {
  name: "typing",
  w: 32,
  h: 36,
  palette,
  frames: [scanLeft, scanRight],
  sequence: SEQUENCE,
  loop: true,
  anchor: 1,
};
saveClipFile(join(ROOT, "public", "mascot", "typing.json"), clip);
console.log("\npreviews → out/typing-strip.png · out/typing.gif");
console.log("exported → public/mascot/typing.json (sustained, anchor: idle f1)");
