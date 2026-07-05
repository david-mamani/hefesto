"use client";

import { useState } from "react";
import { EmberGlow } from "@/components/EmberGlow";
import { HefestoSprite } from "@/components/HefestoSprite";
import { SpeechBubble } from "@/components/SpeechBubble";
import { Composer } from "@/components/Composer";
import { Briefing } from "@/components/Briefing";
import { ChevronRightIcon } from "@/components/icons";
import { useCapture } from "@/components/capture/useCapture";
import { ReviewCapture } from "@/components/capture/ReviewCapture";
import { ForgingCard } from "@/components/capture/ForgingCard";

export type HomePlaceholders = {
  greeting: string;
  meeting: { time: string; when: string; title: string; note: string };
  suggestion: { text: string; cluster: string };
};

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

  const forging = state.phase === "forging" || state.phase === "done";
  const bubbleText =
    state.phase === "forging"
      ? "Forging your memory…"
      : state.phase === "done"
        ? `${state.canonicalName} is in your memory now.`
        : state.phase === "error"
          ? state.message
          : placeholders.greeting;

  const forgingSummary =
    state.phase === "forging" || state.phase === "done"
      ? state.canonicalName
      : "";

  return (
    <>
      {!forging && (
        <>
          <p className="micro-label mt-6 text-[10px] tracking-[1px]">Next meeting</p>

          <section className="relative overflow-hidden h-[150px] rounded-[26px] bg-surface-soft shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)] mt-[6px]">
            <EmberGlow className="w-[220px] h-[90px] right-[-49px] bottom-[-30px]" />

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
        <SpeechBubble>{bubbleText}</SpeechBubble>
      </div>

      <div className="flex justify-center -mt-[7px]">
        <HefestoSprite scale={6} />
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
            <span className="absolute right-[24px] top-1/2 -translate-y-1/2 text-ink">
              <ChevronRightIcon color="#1C1611" />
            </span>
          </section>
        </>
      )}

      <div className="mt-[26px]">
        <Composer
          onSend={(text) => capture.start(text)}
          onVoice={(audio, seconds) => capture.startVoice(audio, seconds)}
          disabled={state.phase === "extracting" || state.phase === "forging"}
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
