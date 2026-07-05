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

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[216px] rounded-[22px] bg-ember shadow-[0px_16px_38px_0px_rgba(51,31,10,0.2)] px-4 py-3">
          <p className="text-[13px] text-cream leading-normal">{renderInline(message.text)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[255px] glass rounded-[22px] px-[14px] py-[10px]">
        <p className="text-[13px] text-ink leading-normal">{renderInline(message.text)}</p>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return <p className="micro-label text-[10px] tracking-[1px]">Hefesto is typing…</p>;
}
