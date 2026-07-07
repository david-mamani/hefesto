"use client";

import { useEffect, useRef, useState } from "react";
import { EmberGlow } from "@/components/EmberGlow";
import { HefestoSprite, type HefestoHandle } from "@/components/HefestoSprite";
import { SpeechBubble } from "@/components/SpeechBubble";
import { ThoughtBubble } from "@/components/ThoughtBubble";
import { Composer } from "@/components/Composer";
import { Briefing } from "@/components/Briefing";
import { ChevronRightIcon } from "@/components/icons";
import { useCapture } from "@/components/capture/useCapture";
import { ReviewCapture } from "@/components/capture/ReviewCapture";
import { nudgesEnabled } from "@/lib/theme";
import { ForgingCard } from "@/components/capture/ForgingCard";
import type { ChatResponse } from "@/components/chat/ChatView";

export type HomePlaceholders = {
  greeting: string;
  meeting: { time: string; when: string; title: string; note: string };
  suggestion: { text: string; cluster: string };
};

// Questions go to recall, statements go to capture — the same convention the
// Telegram bot follows.
const isQuestion = (text: string) => text.includes("?");

const clip = (text: string, max = 140) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

type AskState =
  | { phase: "idle" }
  | { phase: "thinking" }
  | { phase: "answered"; data: ChatResponse }
  | { phase: "error"; message: string };

export function HomeExperience({
  placeholders,
  featuredPersonId,
}: {
  placeholders: HomePlaceholders;
  featuredPersonId?: string | null;
}) {
  const capture = useCapture();
  const { state } = capture;
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [ask, setAsk] = useState<AskState>({ phase: "idle" });
  const [recording, setRecording] = useState(false);
  const conversationRef = useRef<string | null>(null);
  const hefesto = useRef<HefestoHandle>(null);

  // Domain → animation (PRD §22): listening while a voice note records, typing
  // while Hefesto extracts/forges/thinks, doubt on errors. Ambient life
  // (blink/tail/rare "?") runs on its own whenever he is just idling.
  useEffect(() => {
    const h = hefesto.current;
    if (!h) return;
    if (recording) {
      h.play("listening");
      return;
    }
    if (state.phase === "extracting" || state.phase === "forging" || ask.phase === "thinking") {
      h.play("typing");
      return;
    }
    if (state.phase === "error" || ask.phase === "error") {
      h.stop();
      h.play("doubt");
      return;
    }
    // Settled: also cancels an anchor-pending typing that never got to fire
    // (answers can arrive before the breath reaches the rest pose).
    h.stop();
  }, [recording, state.phase, ask.phase]);

  useEffect(() => {
    if (briefingOpen) hefesto.current?.play("alert");
  }, [briefingOpen]);

  // On open, push the cold-contact nudge to the user's linked Telegram (throttled
  // server-side) — unless the user turned proactive nudges off in Account.
  useEffect(() => {
    if (!nudgesEnabled()) return;
    fetch("/api/nudge", { method: "POST" }).catch(() => {});
  }, []);

  // Home ask flow (PRD: the thought bubble is how Hefesto "thinks" a path).
  // A walked path renders as his thought bubble; a plain answer as speech.
  async function askHefesto(question: string) {
    setAsk({ phase: "thinking" });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          conversationId: conversationRef.current ?? undefined,
        }),
      });
      const data = (await res.json()) as ChatResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Recall failed");
      conversationRef.current = data.conversationId;
      setAsk({ phase: "answered", data });
    } catch (error) {
      setAsk({
        phase: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Something went sideways — ask me again.",
      });
    }
  }

  function handleSend(text: string) {
    if (isQuestion(text)) {
      void askHefesto(text);
    } else {
      setAsk({ phase: "idle" });
      capture.start(text);
    }
  }

  const forging = state.phase === "forging" || state.phase === "done";
  const thought =
    state.phase === "idle" && ask.phase === "answered" && ask.data.path.length > 0
      ? ask.data
      : null;
  const bubbleText =
    state.phase === "forging"
      ? "Forging your memory…"
      : state.phase === "done"
        ? `${state.canonicalName} is in your memory now.`
        : state.phase === "error"
          ? state.message
          : ask.phase === "thinking"
            ? "Following the threads…"
            : ask.phase === "error"
              ? ask.message
              : ask.phase === "answered"
                ? clip(ask.data.text)
                : placeholders.greeting;

  // M14 summary line: "Carlos · fintech founder · wants a designer intro"
  const forgingSummary =
    state.phase === "forging" || state.phase === "done"
      ? [
          state.canonicalName,
          capture.fields?.role ?? capture.fields?.company,
          capture.fields?.commitments[0],
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  return (
    <>
      {!forging && (
        <>
          <p className="micro-label mt-6 text-[10px] tracking-[1px]">Next meeting</p>

          <section className="relative overflow-hidden h-[150px] rounded-[26px] bg-surface-soft shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] mt-[6px]">
            <EmberGlow className="w-[220px] h-[90px] right-[-98px] bottom-0" />

            <div className="absolute left-[14px] top-[14px] w-[118px] h-[122px] glass rounded-[20px]">
              <p className="font-light text-[26px] text-ink absolute left-[12px] top-[8px]">
                {placeholders.meeting.time}
              </p>
              <p className="text-[11px] text-muted absolute left-[12px] top-[42px]">
                {placeholders.meeting.when}
              </p>
              <p className="micro-label text-[9px] tracking-[0.9px] absolute left-[12px] bottom-[12px]">
                Briefing
              </p>
            </div>

            <p className="absolute left-[148px] top-[26px] w-[122px] font-semibold text-[15px] text-ink leading-normal">
              {placeholders.meeting.title}
            </p>
            <p className="absolute left-[148px] top-[76px] w-[120px] text-[11.5px] text-muted leading-normal">
              {placeholders.meeting.note}
            </p>

            <button
              type="button"
              aria-label="Open briefing"
              onClick={() => featuredPersonId && setBriefingOpen(true)}
              className="absolute right-[14px] bottom-[16px] size-10 rounded-full bg-ember grid place-items-center"
            >
              <ChevronRightIcon color="#F6F1E8" />
            </button>
          </section>
        </>
      )}

      <div className={`flex justify-center ${forging ? "mt-8" : "mt-[10px]"}`}>
        {thought ? (
          <ThoughtBubble path={thought.path} caption={clip(thought.text, 110)} />
        ) : (
          <SpeechBubble loading={state.phase === "forging"}>{bubbleText}</SpeechBubble>
        )}
      </div>

      <div className={`flex justify-center ${thought ? "mt-[20px]" : "mt-[4px]"}`}>
        <HefestoSprite ref={hefesto} scale={6} ambient />
      </div>

      {forging ? (
        <div className="-mt-2">
          <ForgingCard summary={forgingSummary} done={state.phase === "done"} />
        </div>
      ) : (
        <>
          <p className="micro-label -mt-3 text-[10px] tracking-[1px]">Suggested</p>

          <section className="relative h-[74px] glass rounded-[22px] mt-[5px]">
            <p className="absolute left-[18px] top-[10px] font-medium text-[13px] text-ink">
              {placeholders.suggestion.text}
            </p>
            <span className="absolute left-[18px] top-[34px] h-[30px] px-[14px] rounded-full bg-white text-[12px] font-medium text-[#1C1611] grid place-items-center">
              {placeholders.suggestion.cluster}
            </span>
            <span className="absolute right-[24px] top-[24px] text-ink">
              <ChevronRightIcon color="#1C1611" />
            </span>
          </section>
        </>
      )}

      <div className="mt-[26px] -mx-2">
        <Composer
          onSend={handleSend}
          onVoice={(audio, seconds) => capture.startVoice(audio, seconds)}
          onRecordingChange={setRecording}
          disabled={
            state.phase === "extracting" || state.phase === "forging" || ask.phase === "thinking"
          }
        />
      </div>

      {state.phase === "review" && capture.fields && (
        <ReviewCapture
          fields={capture.fields}
          setFields={capture.setFields}
          candidates={capture.candidates}
          resolution={capture.resolution}
          setResolution={capture.setResolution}
          sourceText={capture.sourceText}
          channel={capture.channel}
          durationSec={capture.durationSec}
          onSave={capture.confirm}
          onDiscard={capture.discard}
        />
      )}
    </>
  );
}
