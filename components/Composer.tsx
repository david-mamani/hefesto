"use client";

import { useState, type FormEvent } from "react";
import { PhotoIcon, MicIcon, ArrowUpIcon } from "@/components/icons";

export function Composer({
  placeholder = "Message Hefesto...",
  onSend,
}: {
  placeholder?: string;
  onSend?: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !onSend) return;
    setText("");
    void onSend(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Add a photo"
        className="size-11 shrink-0 rounded-full bg-white shadow-[0px_10px_24px_0px_rgba(51,31,10,0.1)] grid place-items-center text-ink"
      >
        <PhotoIcon />
      </button>

      <div className="flex-1 h-11 rounded-[22px] bg-white/60 border-[1.2px] border-white/90 flex items-center pl-5 pr-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[12.5px] text-ink placeholder:text-muted focus:outline-none"
        />
        <button type="button" aria-label="Record a voice note" className="text-ink px-1">
          <MicIcon />
        </button>
      </div>

      <button
        type="submit"
        aria-label="Send"
        className="size-11 shrink-0 rounded-full bg-ember grid place-items-center"
      >
        <ArrowUpIcon color="#F6F1E8" />
      </button>
    </form>
  );
}
