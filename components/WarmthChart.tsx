/*
 * "Network warmth · last 30 days" — area + line wave from the dashboard frame.
 * Given `points` (0–100, oldest → newest) it plots the real series; without
 * data it falls back to the frame's illustrative wave.
 */
const VIEW_W = 372;
const VIEW_H = 58;
const Y_TOP = 8; // score 100
const Y_BOTTOM = 54; // score 0

function pathFrom(points: number[]): { line: string; endX: number; endY: number } {
  const n = points.length;
  const stepX = VIEW_W / Math.max(1, n - 1);
  const coords = points.map((score, i) => {
    const x = Math.round(i * stepX * 10) / 10;
    const y =
      Math.round((Y_BOTTOM - (Math.min(100, Math.max(0, score)) / 100) * (Y_BOTTOM - Y_TOP)) * 10) /
      10;
    return { x, y };
  });
  // Smooth the polyline with midpoint quadratic curves.
  let line = `M${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length - 1; i++) {
    const midX = (coords[i].x + coords[i + 1].x) / 2;
    const midY = (coords[i].y + coords[i + 1].y) / 2;
    line += ` Q ${coords[i].x} ${coords[i].y}, ${Math.round(midX * 10) / 10} ${Math.round(midY * 10) / 10}`;
  }
  const last = coords[coords.length - 1];
  line += ` L ${last.x} ${last.y}`;
  return { line, endX: last.x, endY: last.y };
}

const FRAME_WAVE =
  "M0 44 C 30 40, 55 34, 85 35 S 140 42, 170 38 S 225 24, 255 22 S 320 16, 350 12";

export function WarmthChart({
  className = "",
  points,
}: {
  className?: string;
  points?: number[];
}) {
  const { line, endX, endY } =
    points && points.length >= 2 ? pathFrom(points) : { line: FRAME_WAVE, endX: 352, endY: 14 };

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none" className={className} aria-hidden="true">
      <path d={`${line} L ${VIEW_W} ${endY} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`} fill="#FFC490" opacity="0.55" />
      <path d={line} stroke="#F07E12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={endX} cy={endY} r="5" fill="#F07E12" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  );
}
