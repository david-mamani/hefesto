"use client";

import { useRef, useState } from "react";
import { HefestoSprite, type HefestoHandle } from "@/components/HefestoSprite";
import { ThinkingRail } from "@/components/ThinkingRail";
import { ChatView, type ChatResponse } from "@/components/chat/ChatView";

export function DesktopChat({ initialQuestion }: { initialQuestion?: string }) {
  const [last, setLast] = useState<ChatResponse | null>(null);
  const hefesto = useRef<HefestoHandle>(null);
  const sendRef = useRef<((text: string) => void) | null>(null);

  const path = last?.path.map((person) => ({
    label: person.name,
    initial: (person.name[0] ?? "?").toUpperCase(),
  }));

  const evidence = last?.evidence.map((entry) => ({
    initial: ((entry.personName ?? entry.document)[0] ?? "?").toUpperCase(),
    title: entry.personName ? `${entry.personName} · note` : entry.document,
    quote: entry.quote,
  }));

  return (
    <div className="pt-[20px] flex gap-10 items-start">
      <div className="flex-1 min-w-0 flex flex-col min-h-[calc(100dvh-88px)]">
        <h1 className="font-semibold text-[28px] text-ink">Chat</h1>
        <p className="text-[13px] text-muted mt-1">ask your memory anything</p>
        <ChatView
          initialQuestion={initialQuestion}
          sendRef={sendRef}
          onResponse={setLast}
          onSendingChange={(sending) => {
            const h = hefesto.current;
            if (!h) return;
            if (sending) h.play("typing");
            else h.stop(); // also cancels an anchor-pending typing on fast answers
          }}
        />
      </div>

      <div className="relative shrink-0">
        <HefestoSprite ref={hefesto} scale={2} className="absolute right-0 -top-5" ambient />
        <div className="pt-[52px]">
          <ThinkingRail
            path={path && path.length > 0 ? path : undefined}
            hops={path?.length}
            evidence={evidence && evidence.length > 0 ? evidence : undefined}
            onAsk={(question) => sendRef.current?.(question)}
          />
        </div>
      </div>
    </div>
  );
}
