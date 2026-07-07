"use client";

import { useRef, useState, type FormEvent } from "react";
import { MicIcon, ArrowUpIcon } from "@/components/icons";

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Composer({
  placeholder = "Message Hefesto...",
  onSend,
  onVoice,
  onRecordingChange,
  disabled = false,
  large = false,
  initialText = "",
  inputId,
}: {
  placeholder?: string;
  onSend?: (text: string) => void | Promise<void>;
  onVoice?: (audio: Blob, seconds: number) => void | Promise<void>;
  onRecordingChange?: (recording: boolean) => void;
  disabled?: boolean;
  /** M10d: 54px input pill + 54px send circle (mobile stays 44px). */
  large?: boolean;
  /** Prefill (e.g. "Log update" arrives with the person's name ready). */
  initialText?: string;
  /** Lets hosts focus the input (e.g. the first-capture invitation cards). */
  inputId?: string;
}) {
  const [text, setText] = useState(initialText);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !onSend || disabled) return;
    setText("");
    void onSend(trimmed);
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSeconds(0);
  }

  async function toggleMic() {
    if (!onVoice || disabled) return;
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setRecording(false);
        onRecordingChange?.(false);
        stopTimer();
        if (blob.size) void onVoice(blob, dur);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setRecording(true);
      onRecordingChange?.(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      // Permission denied or unsupported (e.g. some iOS states) — capture by text.
      alert("I need microphone access for voice notes. You can also just type it.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div
        className={`flex-1 flex items-center border-[1.2px] ${
          large ? "h-[54px] rounded-[27px] pl-[26px] pr-4" : "h-11 rounded-[22px] pl-5 pr-3"
        } ${recording ? "bg-white/80 border-orange" : "bg-white/60 border-white/90"}`}
      >
        {recording ? (
          <div className="flex-1 flex items-center gap-2">
            <span className="size-[9px] rounded-full bg-orange animate-pulse" />
            <span className="text-[12.5px] text-ink font-medium">Listening… {fmt(seconds)}</span>
          </div>
        ) : (
          <input
            id={inputId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`flex-1 min-w-0 bg-transparent ${
              large ? "text-[13px]" : "text-[12.5px]"
            } text-ink placeholder:text-muted focus:outline-none disabled:opacity-60`}
          />
        )}
        {onVoice && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={recording ? "Stop recording" : "Record a voice note"}
            className={`px-1 ${recording ? "text-orange" : "text-ink"}`}
          >
            {recording ? (
              <span className="grid place-items-center size-5 rounded-[4px] bg-orange" />
            ) : (
              <MicIcon />
            )}
          </button>
        )}
      </div>

      <button
        type="submit"
        aria-label="Send"
        className={`${large ? "size-[54px]" : "size-11"} shrink-0 rounded-full bg-ember grid place-items-center`}
      >
        <ArrowUpIcon color="#F6F1E8" />
      </button>
    </form>
  );
}
