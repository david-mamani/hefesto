import type { ChatPathPerson } from "@/app/api/chat/route";
import { PathTrail } from "@/components/PathTrail";

/*
 * "Hefesto's thinking" as a path — Figma M02b. Renders the graph walk the answer
 * followed: You → connector → target, with the sources it cited. Hops = path length.
 */
export function PathCard({
  path,
  sources,
}: {
  path: ChatPathPerson[];
  sources?: string[];
}) {
  if (!path.length) return null;
  return (
    <div className="glass rounded-[22px] px-[15px] pt-[11px] pb-[14px] mt-3 max-w-[280px]">
      <p className="micro-label text-[8.5px] tracking-[0.85px]">
        Found a path · {path.length} {path.length === 1 ? "hop" : "hops"}
      </p>

      <div className="mt-[15px] mb-[22px] pr-1">
        <PathTrail path={path} />
      </div>

      {sources && sources.length > 0 && (
        <p className="text-[10.5px] text-muted">via: {sources.join(" · ")}</p>
      )}
    </div>
  );
}
