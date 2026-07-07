export function SpeechBubble({
  children,
  loading = false,
}: {
  children: React.ReactNode;
  /** M14: trailing ellipsis dots while Hefesto forges (two solid, one faded, pulsing). */
  loading?: boolean;
}) {
  return (
    <div className="relative w-[250px]">
      <div className="backdrop-blur-[16px] bg-white/55 border-[1.5px] border-white/90 rounded-[18px] shadow-[0px_12px_28px_0px_rgba(51,31,10,0.1)] px-[14px] py-[9px]">
        <p className="text-[12.5px] font-medium text-ink leading-normal">
          {children}
          {loading && (
            <span className="inline-flex items-baseline gap-[4px] ml-[6px]" aria-hidden="true">
              <span className="size-[6px] rounded-full bg-orange animate-pulse" />
              <span className="size-[6px] rounded-full bg-orange animate-pulse [animation-delay:0.2s]" />
              <span className="size-[6px] rounded-full bg-orange/40 animate-pulse [animation-delay:0.4s]" />
            </span>
          )}
        </p>
      </div>
      <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        className="absolute left-[45px] top-full -mt-px"
        aria-hidden="true"
      >
        <path
          d="M2 0.5H14L4.5 11.5L2 0.5Z"
          fill="rgba(255,255,255,0.55)"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
