import type { Metadata } from "next";

import "./globals.css";

import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Diary",
  description: "A local-first diary app that keeps track of ongoing topics over time.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[rgba(255,253,248,0.82)] p-6 shadow-[0_32px_120px_rgba(95,64,30,0.12)] backdrop-blur">
            <header className="flex flex-col gap-6 border-b border-[var(--border)] pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Local-first diary</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight">Diary</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  The app keeps track of ongoing topics, asks about a small planned set each day, and saves everything
                  on your own computer.
                </p>
              </div>
              <Nav />
            </header>
            <div className="pt-6">{children}</div>
          </div>
        </main>
      </body>
    </html>
  );
}
