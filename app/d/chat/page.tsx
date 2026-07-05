import { HefestoSprite } from "@/components/HefestoSprite";
import { ThinkingRail } from "@/components/ThinkingRail";
import { MicIcon, ArrowUpIcon } from "@/components/icons";

export default function DesktopChatPage() {
  return (
    <div className="pt-[20px] flex gap-10 items-start">
      <div className="flex-1 min-w-0 flex flex-col min-h-[calc(100dvh-88px)]">
        <h1 className="font-semibold text-[28px] text-ink">Chat</h1>
        <p className="text-[13px] text-muted mt-1">ask your memory anything</p>

        <div className="flex-1 flex flex-col gap-5 pt-8">
          {/* Conversation renders here once recall is wired to the memory backend */}
        </div>

        <div className="flex items-center gap-4 pb-2">
          <div className="flex-1 max-w-[560px] h-[54px] rounded-[27px] bg-white/60 border-[1.2px] border-white/90 flex items-center pl-6 pr-3">
            <input
              placeholder="Message Hefesto..."
              className="flex-1 min-w-0 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
            />
            <button type="button" aria-label="Record a voice note" className="text-ink px-1">
              <MicIcon />
            </button>
          </div>
          <button
            type="button"
            aria-label="Send"
            className="size-[54px] rounded-full bg-ember grid place-items-center"
          >
            <ArrowUpIcon color="#F6F1E8" />
          </button>
        </div>
      </div>

      <div className="relative shrink-0">
        <HefestoSprite scale={2} className="absolute right-0 -top-5" />
        <div className="pt-[52px]">
          <ThinkingRail />
        </div>
      </div>
    </div>
  );
}
