"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function AuthControls() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="text-xs text-[var(--muted-foreground)]">載入中…</span>
    );
  }

  if (!session?.user) {
    return (
      <Button size="sm" onClick={() => void signIn("google")}>
        使用 Google 登入
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="hidden max-w-[10rem] truncate text-xs text-[var(--muted-foreground)] sm:inline">
        {session.user.name}
      </span>
      <span className="hidden max-w-[10rem] truncate text-xs text-[var(--muted-foreground)] sm:inline">
        {session.user.email}
      </span>
      <Button size="sm" variant="ghost" onClick={() => void signOut()}>
        登出
      </Button>
    </div>
  );
}
