import type { ChatPathPerson } from "@/app/api/chat/route";
import { PathTrail } from "@/components/PathTrail";

/*
 * "Hefesto's thinking" as a path — Figma M02b (mobile) / M10d (wide). Renders
 * the graph walk the answer followed: You → connector → target, with the
 * sources it cited. Hops = path length.
 */
export function PathCard({
  path,
  sources,
  wide = false,
}: {
  path: ChatPathPerson[];
  sources?: string[];
  wide?: boolean;
}) {
  if (!path.length) return null;
  return (
    <div
      className={`glass rounded-[22px] px-[15px] pt-[11px] pb-[14px] mt-3 ${
        wide ? "max-w-[430px]" : "max-w-[270px]"
      }`}
    >
      <p className={`micro-label ${wide ? "text-[9px] tracking-[0.9px]" : "text-[8.5px] tracking-[0.85px]"}`}>
        Found a path · {path.length} {path.length === 1 ? "hop" : "hops"}
      </p>

      <div className="mt-[15px] mb-[30px] pr-1">
        <PathTrail path={path} size={wide ? "lg" : "sm"} />
      </div>

      {sources && sources.length > 0 && (
        <p className="text-[10.5px] text-muted">via: {sources.join(" · ")}</p>
      )}
    </div>
  );
}
