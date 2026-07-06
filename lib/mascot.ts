/*
 * Mascot data layer — clip registry, the clip JSON contract (PRD §21), and mode
 * tinting. Client-safe (no server imports). The engine that plays these lives in
 * components/HefestoSprite.tsx; the animation workshop (P4) drops the clip files.
 */

export type Mode = "networking" | "personal" | "family";

// A clip file as exported from David's pixel tool.
// `indices` = a single static frame; `frames` + `sequence` = an animation.
// `anchor` pins a one-shot to an idle frame: the engine waits until idle rests
// on that frame before playing, and returns to it after — no pose jump.
// `variants` gives a one-shot several alternative sequences over the same
// frames; the engine picks one at random per play, so repeats feel natural.
export type RawClip = {
  w: number;
  h: number;
  palette: (string | null)[];
  indices?: number[];
  frames?: number[][];
  sequence?: { frame: number; ms: number }[];
  loop?: boolean;
  anchor?: number;
  variants?: { frame: number; ms: number }[][];
};

// Every clip the engine knows how to play, mapped to its file in public/mascot/.
// Files arrive during the workshop; the engine loads whichever exist and skips
// the rest, so new clips are drop-in.
// wave/happy were cut by art direction — gestures stay minimal: ambient life
// (blink/tail/doubt), work states (typing/listening) and the alert "!".
export const CLIP_FILES = {
  idle: "idle.json",
  blink: "blink.json",
  tail: "tail.json",
  doubt: "doubt.json",
  typing: "typing.json",
  listening: "listening.json",
  alert: "alert.json",
} as const;

export type ClipName = keyof typeof CLIP_FILES;

// The looping base pose. Everything else is either sustained (loops until
// stopped — typing while Hefesto writes, listening while a voice note records)
// or a one-shot that returns to idle.
export const BASE_CLIP: ClipName = "idle";
export const SUSTAINED: ClipName[] = ["idle", "typing", "listening"];

// Mode colors (PRD §11) — tint the UI's glow/accents, NEVER the cat's palette.
export const MODE_COLORS: Record<Mode, string> = {
  networking: "#2f6bff",
  personal: "#f07e12",
  family: "#3fb57f",
};

/** A person's cluster decides Hefesto's mode (PRD §11). */
export function clusterToMode(cluster: string | null | undefined): Mode {
  if (cluster === "work") return "networking";
  if (cluster === "family") return "family";
  return "personal";
}

/**
 * Tint the UI for a mode by pointing the `--mode` CSS variable at that mode's
 * token. Cards/accents that read `var(--color-mode)` follow; the sprite does not.
 */
export function applyMode(mode: Mode, target?: HTMLElement) {
  const el = target ?? document.documentElement;
  el.style.setProperty("--mode", `var(--mode-${mode})`);
}

/** Fetch a clip JSON from public/mascot/. `bust` forces a fresh copy in the workshop. */
export async function loadClip(file: string, bust?: string | number): Promise<RawClip | null> {
  try {
    const url = bust ? `/mascot/${file}?v=${bust}` : `/mascot/${file}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as RawClip;
  } catch {
    return null;
  }
}

/**
 * The clips currently exported to public/mascot/, per public/mascot/manifest.json.
 * The engine loads only these (plus the idle base), so no 404s for clips the
 * workshop hasn't drawn yet. Each new clip is added to the manifest in P4.
 */
export async function loadManifest(bust?: string | number): Promise<ClipName[]> {
  try {
    const url = bust ? `/mascot/manifest.json?v=${bust}` : `/mascot/manifest.json`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { clips?: string[] };
    const known = new Set(Object.keys(CLIP_FILES));
    return (data.clips ?? []).filter((c): c is ClipName => known.has(c));
  } catch {
    return [];
  }
}
