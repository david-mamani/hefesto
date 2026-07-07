export function RingAvatar({
  initial,
  size = 40,
  className = "",
}: {
  initial: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full grid place-items-center bg-gradient-to-br from-peach to-orange ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="rounded-full bg-surface-soft grid place-items-center font-semibold text-ink"
        style={{ width: size - 6, height: size - 6, fontSize: Math.round(size * 0.3) }}
      >
        {initial}
      </span>
    </span>
  );
}
