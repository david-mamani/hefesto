import type { ChatPathPerson } from "@/app/api/chat/route";

const firstName = (name: string) => name.split(/\s+/)[0] || name;
const initialOf = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

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
    <div className="glass rounded-[22px] px-[18px] py-[15px] mt-3 max-w-[300px]">
      <p className="micro-label text-[9px] tracking-[1px]">
        Found a path · {path.length} {path.length === 1 ? "hop" : "hops"}
      </p>

      <div className="flex items-center mt-[18px] mb-[6px]">
        <span className="size-8 rounded-full bg-ember grid place-items-center text-[9px] font-medium text-cream shrink-0">
          You
        </span>
        {path.map((node) => (
          <div key={node.personId || node.name} className="flex items-center flex-1 min-w-[42px]">
            <span className="flex-1 h-[2px] bg-orange" />
            <span className="relative shrink-0">
              <span className="size-8 rounded-full bg-white ring-2 ring-orange grid place-items-center text-[12px] font-semibold text-ink">
                {initialOf(node.name)}
              </span>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[3px] text-[9.5px] font-medium text-ink whitespace-nowrap">
                {firstName(node.name)}
              </span>
            </span>
          </div>
        ))}
      </div>

      {sources && sources.length > 0 && (
        <p className="text-[10px] text-muted mt-[14px]">via: {sources.join(" · ")}</p>
      )}
    </div>
  );
}
