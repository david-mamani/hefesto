/*
 * "Network warmth · last 30 days" — static area + line wave from the dashboard frame.
 * Becomes data-driven when warmth history exists.
 */
export function WarmthChart({ className = "" }: { className?: string }) {
  const line =
    "M0 44 C 30 40, 55 34, 85 35 S 140 42, 170 38 S 225 24, 255 22 S 320 16, 350 12";
  return (
    <svg viewBox="0 0 372 58" fill="none" className={className} aria-hidden="true">
      <path d={`${line} L 372 14 L 372 58 L 0 58 Z`} fill="#FFC490" opacity="0.55" />
      <path d={line} stroke="#F07E12" strokeWidth="2" strokeLinecap="round" />
      <circle cx="352" cy="14" r="5" fill="#F07E12" stroke="#FFFFFF" strokeWidth="2" />
    </svg>
  );
}
