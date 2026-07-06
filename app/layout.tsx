import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const poppins = Poppins({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Hefesto",
  description: "Never forget anyone again.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hefesto",
  },
};

export const viewport: Viewport = {
  themeColor: "#EFE7DC",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const pref = cookieStore.get("theme")?.value;
  const theme = pref === "dark" ? "dark" : undefined;

  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
      data-theme={theme}
    >
      <body className="min-h-full">
        {pref === "system" && (
          // System preference resolves on the client before first paint.
          <script
            dangerouslySetInnerHTML={{
              __html:
                'if(window.matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"',
            }}
          />
        )}
        {children}
      </body>
    </html>
  );
}
