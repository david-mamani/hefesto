"use client";

/* The design-system switch: 46×26 dark pill, 20px knob. */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[26px] w-[46px] rounded-[13px] transition-colors shrink-0"
      style={{ background: on ? "var(--ember)" : "rgba(28,22,17,0.18)" }}
    >
      <span
        className="absolute top-[3px] size-[20px] rounded-full bg-white transition-[left]"
        style={{ left: on ? 23 : 3 }}
      />
    </button>
  );
}
