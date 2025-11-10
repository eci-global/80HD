import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "80HD",
  description: "Interruption shield and focus companion.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0a0b10"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0b10] text-neutral-100">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
          <header className="mb-12 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">80HD Focus Shield</h1>
              <p className="text-sm text-neutral-400">
                One calm surface for Slack, Teams, and Outlook.
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              Focus mode active
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-8">{children}</main>
        </div>
      </body>
    </html>
  );
}


