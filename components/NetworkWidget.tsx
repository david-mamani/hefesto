/*
 * "Your network" widget — static layout from the dashboard frame.
 * The live version (real people, warmth colors) arrives with the graph phase.
 */
const NODES = [
  { initial: "A", label: "Ana", x: 88.5, y: 108.5 },
  { initial: "L", label: "Leo", x: 338.5, y: 98.5 },
  { initial: "S", label: "Sofía", x: 68.5, y: 238.5 },
  { initial: "C", label: "Carlos", x: 368.5, y: 208.5 },
  { initial: "M", label: "Mom", x: 148.5, y: 328.5 },
  { initial: "J", label: "Jorge", x: 308.5, y: 328.5 },
];

const CENTER = { x: 238.5, y: 228.5 };

export function NetworkWidget() {
  return (
    <section className="glass rounded-[28px] w-[480px] h-[446px] relative shrink-0 overflow-hidden">
      <p className="micro-label absolute left-[22px] top-[18px] text-[10px] tracking-[1px]">
        Your network
      </p>

      <svg className="absolute inset-0" viewBox="0 0 480 446" fill="none" aria-hidden="true">
        {NODES.map((node) => (
          <line
            key={node.initial}
            x1={CENTER.x}
            y1={CENTER.y}
            x2={node.x + 20}
            y2={node.y + 20}
            stroke="rgba(28,22,17,0.25)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {NODES.map((node) => (
        <div
          key={node.initial}
          className="absolute w-[70px] -translate-x-[15px] text-center"
          style={{ left: node.x, top: node.y }}
        >
          <span className="inline-grid place-items-center size-10 rounded-full bg-gradient-to-br from-peach to-orange p-[3px]">
            <span className="grid place-items-center size-full rounded-full bg-bg font-semibold text-[14px] text-ink">
              {node.initial}
            </span>
          </span>
          <p className="text-[10px] font-medium text-ink mt-[2px]">{node.label}</p>
        </div>
      ))}

      <div
        className="absolute size-[52px] rounded-full bg-ember grid place-items-center"
        style={{ left: 212.5, top: 202.5 }}
      >
        <span className="text-[12px] font-medium text-cream">You</span>
      </div>

      <p className="micro-label absolute bottom-[24px] inset-x-0 text-center text-[8.5px] tracking-[0.85px]">
        Orange work · Peach personal · Gold family
      </p>
    </section>
  );
}
