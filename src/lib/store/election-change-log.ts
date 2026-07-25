import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ElectionChangeLogAction =
  | "create"
  | "revise"
  | "update_meta"
  | "update_image"
  | "reset"
  | "close"
  | "reopen"
  | "tally"
  | "add_voters"
  | "remove_voter"
  | "add_managers"
  | "remove_manager";

export async function appendElectionChangeLog(input: {
  electionId: string;
  actorEmail: string;
  action: ElectionChangeLogAction;
  summary: string;
  detail?: Prisma.InputJsonValue;
}): Promise<void> {
  const email = input.actorEmail.trim().toLowerCase();
  if (!email || !input.electionId.trim() || !input.summary.trim()) {
    return;
  }
  await prisma.electionChangeLog.create({
    data: {
      electionId: input.electionId,
      actorEmail: email,
      action: input.action,
      summary: input.summary.trim(),
      detail: input.detail ?? undefined,
    },
  });
}

export async function listElectionChangeLogs(electionId: string) {
  const rows = await prisma.electionChangeLog.findMany({
    where: { electionId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((row) => ({
    id: row.id,
    electionId: row.electionId,
    actorEmail: row.actorEmail,
    action: row.action,
    summary: row.summary,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  }));
}
