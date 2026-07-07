"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { ChatMessageBubble, TypingIndicator, type ChatMessage } from "@/components/ChatMessages";
import { PathCard } from "@/components/chat/PathCard";
import { HefestoSprite, type HefestoHandle } from "@/components/HefestoSprite";
import { RingAvatar } from "@/components/RingAvatar";
import type { ChatEvidence, ChatPathPerson } from "@/app/api/chat/route";

export type ChatResponse = {
  conversationId: string;
  sessionId: string;
  text: string;
  evidence: ChatEvidence[];
  path: ChatPathPerson[];
  sources: string[];
  qaId: string | null;
  mode: "networking" | "personal" | "family";
  pending?: boolean;
};

type Message = ChatMessage & {
  evidence?: ChatEvidence[];
  path?: ChatPathPerson[];
  sources?: string[];
  qaId?: string | null;
  sessionId?: string;
  feedback?: "up" | "down";
};

function viaLabel(message: Message): string | null {
  if (message.path?.length) return message.path.map((p) => p.name).join(" · ");
  if (message.evidence?.length)
    return [...new Set(message.evidence.map((e) => e.document))].join(" · ");
  return null;
}

// M02b feedback affordance: white circles with up/down arrows (down reads muted).
function FeedbackArrow({ down = false, active = false }: { down?: boolean; active?: boolean }) {
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill="none"
      aria-hidden="true"
      style={down ? { transform: "rotate(180deg)" } : undefined}
    >
      <path
        d="M6 13V1M6 1L1.5 5.5M6 1L10.5 5.5"
        stroke={active ? "var(--orange)" : down ? "#96897A" : "#1C1611"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatView({
  initialQuestion,
  onResponse,
  onSendingChange,
  headerInitial,
  suggestions,
  sendRef,
}: {
  initialQuestion?: string;
  onResponse?: (response: ChatResponse) => void;
  /** Fires when a recall starts/ends — hosts drive their own mascot with it. */
  onSendingChange?: (sending: boolean) => void;
  /** Renders the mobile chat header (avatar · title · small mascot, M02). */
  headerInitial?: string;
  /** Empty-state question chips (mobile — desktop surfaces them in the rail). */
  suggestions?: string[];
  /** Lets a host (the desktop rail) push a question into this conversation. */
  sendRef?: React.MutableRefObject<((text: string) => void) | null>;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [thinkDeeper, setThinkDeeper] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const autoSent = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hefesto = useRef<HefestoHandle>(null);

  // The header mascot types along while Hefesto works out an answer.
  const onSendingChangeRef = useRef(onSendingChange);
  onSendingChangeRef.current = onSendingChange;
  useEffect(() => {
    onSendingChangeRef.current?.(sending);
    const h = hefesto.current;
    if (!h) return;
    if (sending) h.play("typing");
    else h.stop(); // also cancels an anchor-pending typing on fast answers
  }, [sending]);

  const send = useCallback(
    async (text: string) => {
      const userMessage: Message = { id: crypto.randomUUID(), role: "user", text };
      setMessages((prev) => [...prev, userMessage]);
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: conversationRef.current ?? undefined,
            thinkDeeper,
          }),
        });
        const data = (await res.json()) as ChatResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Recall failed");

        conversationRef.current = data.conversationId;
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "hefesto",
            text: data.text,
            evidence: data.evidence,
            path: data.path,
            sources: data.sources,
            qaId: data.qaId,
            sessionId: data.sessionId,
          },
        ]);
        onResponse?.(data);
      } catch (error) {
        hefesto.current?.play("doubt");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "hefesto",
            text:
              error instanceof Error && error.message
                ? error.message
                : "Something went sideways — try again.",
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [onResponse, thinkDeeper]
  );

  useEffect(() => {
    if (initialQuestion && !autoSent.current) {
      autoSent.current = true;
      void send(initialQuestion);
    }
  }, [initialQuestion, send]);

  useEffect(() => {
    if (!sendRef) return;
    sendRef.current = send;
    return () => {
      sendRef.current = null;
    };
  }, [sendRef, send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function giveFeedback(message: Message, thumbs: "up" | "down") {
    if (!message.qaId || !message.sessionId || message.feedback) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, feedback: thumbs } : m))
    );
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qaId: message.qaId, sessionId: message.sessionId, thumbs }),
    }).catch(() => {});
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {headerInitial && (
        <header className="flex items-center gap-3 pt-12">
          <RingAvatar initial={headerInitial} />
          <h1 className="font-semibold text-[26px] text-ink">Chat</h1>
          <HefestoSprite ref={hefesto} scale={2} className="ml-auto -mt-3" ambient />
        </header>
      )}
      <div className="flex-1 flex flex-col gap-4 pt-7 overflow-y-auto">
        {messages.length === 0 && !sending && !!suggestions?.length && (
          <div>
            <p className="micro-label text-[10px] tracking-[1px]">Try asking</p>
            <div className="flex flex-col gap-[10px] mt-[10px]">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => void send(question)}
                  className="glass rounded-[22px] min-h-[44px] flex items-center px-5 text-left"
                >
                  <span className="text-[12.5px] font-medium text-ink">{question}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id}>
            <ChatMessageBubble message={message} />

            {message.role === "hefesto" && !!message.path?.length && (
              <PathCard path={message.path} sources={message.sources} />
            )}

            {message.role === "hefesto" && (message.qaId || (!message.path?.length && viaLabel(message))) && (
              <div className="flex items-center gap-3 mt-2 ml-1">
                {!message.path?.length && viaLabel(message) && (
                  <p className="text-[10.5px] text-muted">via: {viaLabel(message)}</p>
                )}
                {message.qaId && (
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Helpful"
                      onClick={() => giveFeedback(message, "up")}
                      className="size-[34px] rounded-full bg-white shadow-[0px_8px_18px_rgba(51,31,10,0.12)] grid place-items-center"
                    >
                      <FeedbackArrow active={message.feedback === "up"} />
                    </button>
                    <button
                      type="button"
                      aria-label="Not helpful"
                      onClick={() => giveFeedback(message, "down")}
                      className="size-[34px] rounded-full bg-white shadow-[0px_8px_18px_rgba(51,31,10,0.12)] grid place-items-center"
                    >
                      <FeedbackArrow down active={message.feedback === "down"} />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className="mt-1">
            <TypingIndicator />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center justify-end pb-2">
        <button
          type="button"
          onClick={() => setThinkDeeper((v) => !v)}
          className={`h-[26px] px-4 rounded-full text-[10px] font-medium tracking-[0.5px] mb-2 ${
            thinkDeeper
              ? "bg-ember text-cream"
              : "bg-white/55 border border-white/90 text-muted"
          }`}
        >
          Think deeper
        </button>
      </div>
      <div className="pb-2">
        <Composer onSend={send} disabled={sending} />
      </div>
    </div>
  );
}
