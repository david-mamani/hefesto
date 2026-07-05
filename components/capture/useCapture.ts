"use client";

import { useCallback, useRef, useState } from "react";
import type { ConfirmedFields } from "@/lib/capture";
import type { ExtractedCapture } from "@/lib/groq";

export type CaptureCandidate = {
  personId: string;
  canonicalName: string;
  cluster: string | null;
};

export type CaptureState =
  | { phase: "idle" }
  | { phase: "extracting" }
  | { phase: "review" }
  | { phase: "forging"; canonicalName: string }
  | { phase: "done"; canonicalName: string }
  | { phase: "error"; message: string };

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export function useCapture() {
  const [state, setState] = useState<CaptureState>({ phase: "idle" });
  const [fields, setFields] = useState<ConfirmedFields | null>(null);
  const [candidates, setCandidates] = useState<CaptureCandidate[]>([]);
  const [resolution, setResolution] = useState<{ kind: "new" } | { kind: "existing"; personId: string }>({
    kind: "new",
  });
  const sourceText = useRef("");

  const start = useCallback(async (text: string) => {
    sourceText.current = text;
    setState({ phase: "extracting" });
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");

      const extraction = data.extraction as ExtractedCapture;
      setFields({
        name: extraction.name ?? "",
        cluster: extraction.cluster,
        role: extraction.role,
        company: extraction.company,
        interests: extraction.interests,
        metAtEvent: extraction.met_at.event,
        metAtDate: extraction.met_at.date,
        relationship: extraction.relationship,
        facts: extraction.facts,
        commitments: extraction.commitments,
      });
      setCandidates(data.candidates ?? []);
      setResolution({ kind: "new" });
      setState({ phase: "review" });
    } catch (error) {
      setState({ phase: "error", message: error instanceof Error ? error.message : "Extraction failed" });
    }
  }, []);

  const confirm = useCallback(async () => {
    if (!fields) return;
    try {
      const res = await fetch("/api/capture/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution: resolution.kind,
          personId: resolution.kind === "existing" ? resolution.personId : undefined,
          fields,
          sourceText: sourceText.current,
          channel: "web",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setState({ phase: "forging", canonicalName: data.canonicalName });

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        const statusRes = await fetch(
          `/api/capture/status?filename=${encodeURIComponent(data.filename)}&personId=${data.personId}`
        );
        const status = await statusRes.json();
        if (status.status === "completed") {
          setState({ phase: "done", canonicalName: data.canonicalName });
          return;
        }
        if (status.status === "failed") {
          throw new Error("Memory pipeline failed — try capturing again");
        }
      }
      throw new Error("Memory is taking longer than expected — it will appear soon");
    } catch (error) {
      setState({ phase: "error", message: error instanceof Error ? error.message : "Save failed" });
    }
  }, [fields, resolution]);

  const discard = useCallback(() => {
    setFields(null);
    setCandidates([]);
    setState({ phase: "idle" });
  }, []);

  return {
    state,
    fields,
    setFields,
    candidates,
    resolution,
    setResolution,
    start,
    confirm,
    discard,
    reset: discard,
    sourceText: sourceText.current,
  };
}
