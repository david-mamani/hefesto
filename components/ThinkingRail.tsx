import { ChevronRightIcon } from "@/components/icons";
import { SUGGESTED_QUESTIONS } from "@/lib/suggested";

export type ThinkingPathNode = { label: string; initial: string };
export type ThinkingEvidence = { initial: string; title: string; quote: string };

export function ThinkingRail({
  path,
  hops,
  evidence,
  onAsk,
}: {
  path?: ThinkingPathNode[];
  hops?: number;
  evidence?: ThinkingEvidence[];
  onAsk?: (question: string) => void;
}) {
  return (
    <aside className="glass rounded-[28px] w-[440px] shrink-0 px-[22px] py-[20px]">
      <p className="micro-label text-[10px] tracking-[1px]">Hefesto&apos;s thinking</p>

      {path && path.length > 0 && (
        <section className="bg-surface-soft rounded-[22px] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] mt-3 px-[18px] py-[14px]">
          <p className="micro-label text-[9px] tracking-[0.9px]">Path</p>
          <div className="flex items-center mt-4">
            <span className="size-8 rounded-full bg-ember grid place-items-center text-[9px] font-medium text-cream shrink-0">
              You
            </span>
            {path.map((node) => (
              <div key={node.label} className="flex items-center flex-1">
                <span className="flex-1 h-[2px] bg-orange" />
                <span className="relative shrink-0">
                  <span className="size-8 rounded-full bg-white ring-2 ring-orange grid place-items-center text-[12px] font-semibold text-ink">
                    {node.initial}
                  </span>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[2px] text-[9.5px] font-medium text-ink">
                    {node.label}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-muted mt-7">
            {hops ?? path.length} hops · confidence high
          </p>
        </section>
      )}

      {evidence && evidence.length > 0 && (
        <>
          <p className="micro-label mt-6 text-[10px] tracking-[1px]">Evidence</p>
          <div className="flex flex-col gap-[10px] mt-[10px]">
            {evidence.map((item) => (
              <div
                key={item.title}
                className="bg-surface-soft rounded-[18px] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] flex items-center gap-3 px-4 py-2 min-h-[58px]"
              >
                <span className="size-[26px] rounded-full bg-gradient-to-br from-peach to-orange grid place-items-center text-[10px] font-semibold text-ink shrink-0">
                  {item.initial}
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-ink truncate">{item.title}</p>
                  <p className="text-[11px] text-muted truncate">&quot;{item.quote}&quot;</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="micro-label mt-6 text-[10px] tracking-[1px]">Suggested</p>
      <div className="flex flex-col gap-[10px] mt-[10px]">
        {SUGGESTED_QUESTIONS.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onAsk?.(question)}
            className="bg-surface-soft rounded-[22px] shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] min-h-[44px] py-1 flex items-center justify-between gap-3 px-5 text-left"
          >
            <span className="text-[12.5px] font-medium text-ink">{question}</span>
            <ChevronRightIcon color="#1C1611" />
          </button>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-7">
        The thinking panel shows HOW Hefesto answered: the graph path it walked and the
        memories it cited.
      </p>
    </aside>
  );
}
