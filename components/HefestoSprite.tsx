"use client";

import { useEffect, useRef } from "react";

type SpriteData = {
  w: number;
  h: number;
  palette: (string | null)[];
  indices: number[];
};

/*
 * Static renderer for the official 32x36 Hefesto sprite.
 * Integer scaling only, no smoothing — pixel-art rules from the animation contract.
 * The full clip engine replaces this in a later phase; the JSON format is shared.
 */
export function HefestoSprite({
  scale = 6,
  src = "/mascot/hefesto-static.json",
  className,
}: {
  scale?: number;
  src?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(src);
      if (!res.ok) return;
      const sprite: SpriteData = await res.json();
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      const cell = scale * dpr;
      canvas.width = sprite.w * cell;
      canvas.height = sprite.h * cell;
      canvas.style.width = `${sprite.w * scale}px`;
      canvas.style.height = `${sprite.h * scale}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sprite.indices.forEach((paletteIndex, i) => {
        const color = sprite.palette[paletteIndex];
        if (!color) return;
        ctx.fillStyle = color;
        ctx.fillRect((i % sprite.w) * cell, Math.floor(i / sprite.w) * cell, cell, cell);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [scale, src]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}
