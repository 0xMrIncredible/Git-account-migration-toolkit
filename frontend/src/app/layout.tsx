import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitMigrate",
  description: "Git account tools — check, fork, mirror, and fix contributions",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-[var(--text)] no-underline">
              GitMigrate
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/check" className="text-[var(--muted)] hover:text-[var(--text)]">
                1. Check account
              </Link>
              <Link href="/fork" className="text-[var(--muted)] hover:text-[var(--text)]">
                2. Fork
              </Link>
              <Link href="/mirror" className="text-[var(--muted)] hover:text-[var(--text)]">
                3. Mirror
              </Link>
              <Link href="/rewrite" className="text-[var(--muted)] hover:text-[var(--text)]">
                4. Fix contributions
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
