"use client";

import { useState } from "react";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { CaptureModal } from "@/components/capture/CaptureModal";

export function DesktopShell({
  name,
  secondary,
  children,
}: {
  name: string;
  secondary: string;
  children: React.ReactNode;
}) {
  const [captureOpen, setCaptureOpen] = useState(false);

  return (
    <div className="max-w-[1440px] mx-auto flex gap-9 px-6 py-6 min-h-dvh">
      <DesktopSidebar name={name} secondary={secondary} onCapture={() => setCaptureOpen(true)} />
      <main className="flex-1 min-w-0">{children}</main>
      <CaptureModal open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}
