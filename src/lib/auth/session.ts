import { auth, isAdminEmail } from "@/auth";
import {
  canManageElection,
  getElection,
  type ElectionState,
} from "@/lib/store/election-store";

export async function requireSessionUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) {
    return { ok: false as const, error: "請先以 Google 帳號登入", email: null };
  }
  return {
    ok: true as const,
    email,
    name: session?.user?.name ?? email,
    isSystemAdmin: isAdminEmail(email),
    /** @deprecated 使用 isSystemAdmin */
    isAdmin: isAdminEmail(email),
  };
}

/** 系統管理者（ADMIN_EMAILS） */
export async function requireSystemAdmin() {
  const user = await requireSessionUser();
  if (!user.ok) {
    return user;
  }
  if (!user.isSystemAdmin) {
    return {
      ok: false as const,
      error: "需要系統管理者權限",
      email: user.email,
    };
  }
  return user;
}

/** @deprecated 改用 requireSystemAdmin 或 requireElectionManager */
export async function requireAdminUser() {
  return requireSystemAdmin();
}

export async function requireElectionManager(electionId: string) {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return {
      ok: false as const,
      error: "請先以 Google 帳號登入",
      email: null as string | null,
      election: null as ElectionState | null,
    };
  }
  const election = await getElection(electionId);
  if (!election) {
    return {
      ok: false as const,
      error: "找不到此投票",
      email: user.email,
      election: null as ElectionState | null,
    };
  }
  if (!canManageElection(election, user.email, user.isSystemAdmin)) {
    return {
      ok: false as const,
      error: "你不是此投票的管理者",
      email: user.email,
      election: null as ElectionState | null,
    };
  }
  return {
    ok: true as const,
    email: user.email,
    name: user.name,
    isSystemAdmin: user.isSystemAdmin,
    isAdmin: user.isSystemAdmin,
    election,
  };
}
