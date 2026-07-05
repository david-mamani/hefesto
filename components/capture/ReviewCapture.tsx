"use client";

import { useState } from "react";
import type { ConfirmedFields } from "@/lib/capture";
import type { CaptureCandidate } from "@/components/capture/useCapture";
import { ChevronRightIcon } from "@/components/icons";

const CLUSTER_LABEL: Record<ConfirmedFields["cluster"], string> = {
  work: "Networking",
  personal: "Personal",
  family: "Family",
};

const CLUSTER_ORDER: ConfirmedFields["cluster"][] = ["work", "personal", "family"];

function FieldRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <div className="mt-[14px]">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="micro-label text-[10px] tracking-[1px]">{label}</p>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                onChange(draft);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-full bg-transparent text-[13.5px] text-ink border-b border-(--input-border) focus:outline-none mt-[2px]"
            />
          ) : (
            <p className="text-[13.5px] text-ink mt-[2px]">{value || "—"}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="text-[11.5px] font-medium text-muted shrink-0 ml-3 mt-2"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

export function ReviewCapture({
  fields,
  setFields,
  candidates,
  resolution,
  setResolution,
  sourceText,
  onSave,
  onDiscard,
}: {
  fields: ConfirmedFields;
  setFields: (fields: ConfirmedFields) => void;
  candidates: CaptureCandidate[];
  resolution: { kind: "new" } | { kind: "existing"; personId: string };
  setResolution: (r: { kind: "new" } | { kind: "existing"; personId: string }) => void;
  sourceText: string;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const companyRole = [fields.company, fields.role].filter(Boolean).join(" · ");
  const metAt = [fields.metAtEvent, fields.metAtDate].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="w-full max-w-[390px] mx-auto px-6 pb-10 min-h-full flex flex-col">
        <button
          type="button"
          onClick={onDiscard}
          aria-label="Back"
          className="mt-[52px] w-fit text-ink"
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
            <path d="M10.5 1.5L2 10L10.5 18.5" stroke="#1C1611" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="font-semibold text-[24px] text-ink mt-3">Review capture</h1>

        <div className="glass rounded-3xl h-12 mt-5 flex items-center px-4 gap-3 overflow-hidden">
          <span className="micro-label text-[9.5px] tracking-[0.95px] shrink-0">Text</span>
          <p className="text-[12px] text-muted truncate">&quot;{sourceText}&quot;</p>
        </div>

        <section className="glass rounded-[26px] mt-4 px-[18px] pt-[14px] pb-[20px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[20px] text-ink min-w-0 truncate">
              {fields.name || "Someone new"}
            </h2>
            <button
              type="button"
              onClick={() => {
                const next =
                  CLUSTER_ORDER[(CLUSTER_ORDER.indexOf(fields.cluster) + 1) % CLUSTER_ORDER.length];
                setFields({ ...fields, cluster: next });
              }}
              className="h-[26px] px-4 rounded-full bg-ember text-cream text-[9px] font-medium tracking-[0.9px] uppercase shrink-0 ml-3"
            >
              {CLUSTER_LABEL[fields.cluster]}
            </button>
          </div>

          <FieldRow
            label="Company · Role"
            value={companyRole}
            onChange={(next) => {
              const [company, role] = next.split("·").map((s) => s.trim());
              setFields({ ...fields, company: company || null, role: role || null });
            }}
          />
          <FieldRow
            label="Interests"
            value={fields.interests.join(", ")}
            onChange={(next) =>
              setFields({
                ...fields,
                interests: next.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <FieldRow
            label="Wants"
            value={fields.commitments.join(", ")}
            onChange={(next) =>
              setFields({
                ...fields,
                commitments: next.split(",").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
          <FieldRow
            label="Met at"
            value={metAt}
            onChange={(next) => {
              const [event, date] = next.split("·").map((s) => s.trim());
              setFields({ ...fields, metAtEvent: event || null, metAtDate: date || null });
            }}
          />
        </section>

        {candidates.length > 0 && (
          <section className="glass rounded-3xl mt-4 px-[18px] py-[12px]">
            <p className="text-[13.5px] font-medium text-ink">Looks like a new person</p>
            <p className="text-[11.5px] text-muted mt-1">
              Save as new, or same as {candidates[0].canonicalName}
              {candidates[0].cluster ? ` (${CLUSTER_LABEL[candidates[0].cluster as ConfirmedFields["cluster"]] ?? candidates[0].cluster})` : ""}?
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={() => setResolution({ kind: "new" })}
                className={`h-[34px] px-4 rounded-full text-[12.5px] font-medium ${
                  resolution.kind === "new"
                    ? "bg-ember text-cream"
                    : "bg-white/55 border border-white/90 text-ink"
                }`}
              >
                New
              </button>
              {candidates.map((candidate) => (
                <button
                  key={candidate.personId}
                  type="button"
                  onClick={() => setResolution({ kind: "existing", personId: candidate.personId })}
                  className={`h-[34px] px-4 rounded-full text-[12.5px] font-medium ${
                    resolution.kind === "existing" && resolution.personId === candidate.personId
                      ? "bg-ember text-cream"
                      : "bg-white/55 border border-white/90 text-ink"
                  }`}
                >
                  {candidate.canonicalName}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center gap-2 mt-auto pt-8">
          <button
            type="button"
            disabled={saving || !fields.name.trim()}
            onClick={() => {
              setSaving(true);
              onSave();
            }}
            className="h-[54px] px-7 rounded-full bg-ember text-cream text-[15px] font-medium disabled:opacity-70"
          >
            {saving ? "Saving…" : "Save to memory"}
          </button>
          <button
            type="button"
            disabled={saving || !fields.name.trim()}
            onClick={() => {
              setSaving(true);
              onSave();
            }}
            aria-label="Save to memory"
            className="size-[54px] rounded-full bg-ember grid place-items-center disabled:opacity-70"
          >
            <ChevronRightIcon color="#F6F1E8" />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onDiscard}
            className="h-[54px] px-5 rounded-full bg-white text-[12.5px] font-medium text-[#1C1611] ml-auto"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
