import { NextResponse } from "next/server";
import { z } from "zod";
import { requireElectionManager } from "@/lib/auth/session";
import {
  addElectionManagers,
  listElectionManagers,
  removeElectionManager,
} from "@/lib/store/election-store";
import { appendElectionChangeLog } from "@/lib/store/election-change-log";

const addManagersSchema = z.object({
  electionId: z.string().min(1),
  emails: z
    .string()
    .min(3, "請輸入至少一個 Email")
    .transform((value) =>
      value
        .split(/[\n,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0),
    )
    .pipe(z.array(z.string().email("Email 格式不正確")).min(1)),
});

const removeManagerSchema = z.object({
  electionId: z.string().min(1),
  email: z.string().email(),
});

export async function GET(request: Request) {
  const electionId = new URL(request.url).searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }
  const access = await requireElectionManager(electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  const managers = await listElectionManagers(electionId);
  return NextResponse.json({
    ok: true,
    managers,
    createdByEmail: access.election?.createdByEmail ?? null,
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = addManagersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  const access = await requireElectionManager(parsed.data.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  const result = await addElectionManagers(
    parsed.data.electionId,
    parsed.data.emails,
  );
  if (result.added.length > 0) {
    await appendElectionChangeLog({
      electionId: parsed.data.electionId,
      actorEmail: access.email,
      action: "add_managers",
      summary: `新增 ${result.added.length} 位共同管理者`,
      detail: { added: result.added, skipped: result.skipped },
    });
  }
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(request: Request) {
  const body: unknown = await request.json();
  const parsed = removeManagerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  const access = await requireElectionManager(parsed.data.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  try {
    const removed = await removeElectionManager(
      parsed.data.electionId,
      parsed.data.email,
    );
    if (!removed) {
      return NextResponse.json(
        { ok: false, error: "找不到此共同管理者" },
        { status: 404 },
      );
    }
    await appendElectionChangeLog({
      electionId: parsed.data.electionId,
      actorEmail: access.email,
      action: "remove_manager",
      summary: `移除共同管理者 ${parsed.data.email}`,
      detail: { email: parsed.data.email },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "移除失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
