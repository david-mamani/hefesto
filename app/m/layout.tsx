import { MobileDock } from "@/components/MobileDock";

export default function MobileLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-dvh w-full max-w-[430px] mx-auto pb-[104px]">
      {children}
      <MobileDock />
    </div>
  );
}
