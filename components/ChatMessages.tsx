export type ChatMessage = {
  id: string;
  role: "user" | "hefesto";
  text: string;
};

// Answers come back with light markdown emphasis — render **bold** inline
function renderInline(text: string): React.ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// M02 sizes by default; `wide` = the desktop chat column (M10d: 360/430px bubbles).
export function ChatMessageBubble({ message, wide = false }: { message: ChatMessage; wide?: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={`rounded-[22px] bg-ember shadow-[0px_16px_38px_0px_rgba(51,31,10,0.2)] py-3 ${
            wide ? "max-w-[360px] px-[18px]" : "max-w-[216px] px-4"
          }`}
        >
          <p className={`${wide ? "text-[13.5px]" : "text-[13px]"} text-cream leading-normal`}>
            {renderInline(message.text)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className={`glass rounded-[22px] px-[14px] py-[10px] ${wide ? "max-w-[430px]" : "max-w-[255px]"}`}>
        <p className={`${wide ? "text-[13.5px]" : "text-[13px]"} text-ink leading-normal`}>
          {renderInline(message.text)}
        </p>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return <p className="micro-label text-[10px] tracking-[1px]">Hefesto is typing…</p>;
}
