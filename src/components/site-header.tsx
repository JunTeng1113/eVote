"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { AuthControls } from "@/components/auth-controls";

const publicLinks = [
  { href: "/", label: "首頁" },
  { href: "/vote", label: "投票" },
  { href: "/confirm", label: "確認投票" },
];

export function SiteHeader() {
  const { status } = useSession();

  return (
    <header className="border-b border-[var(--border)]/70 bg-[var(--background)]/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--primary)]">
            eVote
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-[var(--foreground)]/80 transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
          {status === "authenticated" ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-[var(--foreground)]/80 transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              投票管理
            </Link>
          ) : null}
          <div className="ml-1 pl-1">
            <AuthControls />
          </div>
        </nav>
      </div>
    </header>
  );
}
