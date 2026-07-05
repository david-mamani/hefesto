"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MicIcon, ArrowUpIcon } from "@/components/icons";
import { SearchIcon } from "@/components/icons-desktop";

export function AskBar() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={submit}
      className="glass rounded-[27px] h-[54px] max-w-[700px] mt-9 flex items-center pl-5 pr-2 gap-3"
    >
      <SearchIcon color="var(--ink)" />
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask Hefesto…"
        className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-muted focus:outline-none"
      />
      <button type="button" aria-label="Record a voice note" className="text-ink px-1">
        <MicIcon />
      </button>
      <button
        type="submit"
        aria-label="Ask"
        className="size-10 rounded-full bg-ember grid place-items-center"
      >
        <ArrowUpIcon color="#F6F1E8" />
      </button>
    </form>
  );
}
