import type { ChatPathPerson } from "@/app/api/chat/route";

const firstName = (name: string) => name.split(" · ")[0].split(/\s+/)[0] || name;
const initialOf = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

/*
 * The walked path (M02b language): You (dark) → orange connectors → white nodes
 * with initials and first names. Shared by the chat path card and the Home
 * thought bubble. `size="lg"` is the desktop path card (M10d: 30px nodes).
 */
export function PathTrail({ path, size = "sm" }: { path: ChatPathPerson[]; size?: "sm" | "lg" }) {
  const lg = size === "lg";
  const node = lg ? "size-[30px]" : "size-[26px]";
  return (
    <div className="flex items-center">
      <span
        className={`${node} rounded-full bg-ember grid place-items-center ${
          lg ? "text-[8.5px]" : "text-[7.5px]"
        } font-medium text-cream shrink-0`}
      >
        You
      </span>
      {path.map((node2) => (
        <div
          key={node2.personId || node2.name}
          className={`flex items-center flex-1 ${lg ? "min-w-[110px]" : "min-w-[40px]"}`}
        >
          <span className="flex-1 h-[2px] bg-orange" />
          <span className="relative shrink-0">
            <span
              className={`${node} rounded-full bg-white shadow-[0px_6px_14px_rgba(51,31,10,0.18)] grid place-items-center ${
                lg ? "text-[12px]" : "text-[11px]"
              } font-semibold text-ink`}
            >
              {initialOf(node2.name)}
            </span>
            <span
              className={`absolute top-full left-1/2 -translate-x-1/2 mt-[4px] ${
                lg ? "text-[9.5px]" : "text-[8.5px]"
              } font-medium text-ink whitespace-nowrap`}
            >
              {firstName(node2.name)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
