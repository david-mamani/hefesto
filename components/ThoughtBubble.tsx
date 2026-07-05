import type { ChatPathPerson } from "@/app/api/chat/route";
import { PathTrail } from "@/components/PathTrail";

/*
 * The THOUGHT state of Hefesto's bubble — shown when an answer followed a path
 * through the graph: FOUND A PATH · N HOPS, the mini walk, and the conclusion
 * as a caption, with thought circles descending toward the cat.
 */
export function ThoughtBubble({
  path,
  caption,
}: {
  path: ChatPathPerson[];
  caption: string;
}) {
  return (
    <div className="relative w-[280px]">
      <div className="backdrop-blur-[16px] bg-white/55 border-[1.5px] border-white/90 rounded-[22px] shadow-[0px_12px_28px_0px_rgba(51,31,10,0.1)] px-[15px] pt-[11px] pb-[13px]">
        <p className="micro-label text-[8.5px] tracking-[0.85px]">
          Found a path · {path.length} {path.length === 1 ? "hop" : "hops"}
        </p>

        <div className="mt-[14px] mb-[22px] pr-1">
          <PathTrail path={path} />
        </div>

        <p className="text-[11.5px] text-ink leading-snug">{caption}</p>
      </div>

      {/* thought circles descending toward the cat */}
      <span className="absolute left-[56px] top-full mt-[4px] size-[9px] rounded-full bg-white/60 border border-white/90" aria-hidden="true" />
      <span className="absolute left-[46px] top-full mt-[17px] size-[6px] rounded-full bg-white/60 border border-white/90" aria-hidden="true" />
    </div>
  );
}
