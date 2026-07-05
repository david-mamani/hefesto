import type { ChatPathPerson } from "@/app/api/chat/route";

const firstName = (name: string) => name.split(" · ")[0].split(/\s+/)[0] || name;
const initialOf = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/*
 * The walked path (M02b language): You (dark) → orange connectors → white nodes
 * with initials and first names. Shared by the chat path card and the Home
 * thought bubble.
 */
export function PathTrail({ path }: { path: ChatPathPerson[] }) {
  return (
    <div className="flex items-center">
      <span className="size-[26px] rounded-full bg-ember grid place-items-center text-[7.5px] font-medium text-cream shrink-0">
        You
      </span>
      {path.map((node) => (
        <div key={node.personId || node.name} className="flex items-center flex-1 min-w-[40px]">
          <span className="flex-1 h-[2px] bg-orange" />
          <span className="relative shrink-0">
            <span className="size-[26px] rounded-full bg-white shadow-[0px_6px_14px_rgba(51,31,10,0.18)] grid place-items-center text-[11px] font-semibold text-ink">
              {initialOf(node.name)}
            </span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-[4px] text-[8.5px] font-medium text-ink whitespace-nowrap">
              {firstName(node.name)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
