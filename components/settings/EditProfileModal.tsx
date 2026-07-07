"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/* Edit profile: the display name Hefesto greets you by (auth user_metadata). */
export function EditProfileModal({
  currentName,
  onClose,
}: {
  currentName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: trimmed },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-8" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(28,22,17,0.38)]" />
      <div
        className="relative w-full max-w-[320px] rounded-[28px] bg-surface-soft px-6 pt-6 pb-5 shadow-[0px_16px_38px_0px_rgba(51,31,10,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-[20px] text-ink">Edit profile</h3>
        <p className="text-[12px] text-muted mt-1">The name Hefesto greets you by.</p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="Your name"
          autoFocus
          className="w-full h-12 rounded-3xl bg-input border border-(--input-border) px-5 mt-4 text-[13px] text-ink placeholder:text-muted focus:outline-none"
        />
        {error && <p className="text-[12px] text-orange mt-2">{error}</p>}

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={save}
            disabled={busy || !name.trim()}
            className="h-12 flex-1 rounded-[24px] bg-ember text-cream text-[13.5px] font-medium disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-[80px] rounded-[24px] bg-input text-[12.5px] font-medium text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
