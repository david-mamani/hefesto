/*
 * The "ember" — flattened glow shapes stacked with heavy blur, never circles on the page.
 * Lives ONLY inside key cards and carries the active mode color (page backgrounds stay clean).
 */
export function EmberGlow({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      <div className="absolute inset-0 rounded-full bg-mode opacity-40 blur-[36px]" />
      <div className="absolute inset-x-[15%] inset-y-[30%] rounded-full bg-mode opacity-50 blur-[20px]" />
    </div>
  );
}
