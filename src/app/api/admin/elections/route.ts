import { NextResponse } from "next/server";
import {
  requireElectionManager,
  requireSessionUser,
} from "@/lib/auth/session";
import {
  createElection,
  deleteElection,
  electionSummary,
  listManagedElections,
  publicElectionView,
  resetElection,
  updateCandidateImage,
  updateElectionMeta,
} from "@/lib/store/election-store";
import { buildPublicElectionView } from "@/lib/election-view";
import {
  createElectionSchema,
  electionIdSchema,
  updateCandidateImageSchema,
  updateElectionSchema,
} from "@/lib/schemas/voting";

function parseVoterEmails(raw?: string): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export async function GET() {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return NextResponse.json(user, { status: 401 });
  }
  try {
    const elections = await listManagedElections(
      user.email,
      user.isSystemAdmin,
    );
    return NextResponse.json({
      ok: true,
      isSystemAdmin: user.isSystemAdmin,
      elections: elections.map((e) => ({
        ...electionSummary(e),
        ...buildPublicElectionView(e),
        myRole: user.isSystemAdmin
          ? "system"
          : e.createdByEmail === user.email
            ? "creator"
            : "manager",
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法載入投票列表";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return NextResponse.json(user, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = createElectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }

  try {
    const election = await createElection({
      title: parsed.data.title,
      description: parsed.data.description,
      votingMode: parsed.data.votingMode,
      scheduleMode: parsed.data.scheduleMode,
      votingStartsAt:
        parsed.data.scheduleMode === "timed"
          ? parsed.data.votingStartsAt
          : null,
      votingEndsAt:
        parsed.data.scheduleMode === "timed" ? parsed.data.votingEndsAt : null,
      durationMinutes:
        parsed.data.scheduleMode === "duration"
          ? parsed.data.durationMinutes
          : undefined,
      createdByEmail: user.email,
      candidates: parsed.data.candidates,
      voterEmails: parseVoterEmails(parsed.data.voterEmails),
    });

    return NextResponse.json({
      ok: true,
      election: buildPublicElectionView(election),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "建立失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const body: unknown = await request.json();

  const imagePatch = updateCandidateImageSchema.safeParse(body);
  if (imagePatch.success) {
    const access = await requireElectionManager(imagePatch.data.electionId);
    if (!access.ok) {
      return NextResponse.json(access, { status: 403 });
    }
    try {
      const election = await updateCandidateImage(
        imagePatch.data.electionId,
        imagePatch.data.candidateId,
        imagePatch.data.imageUrl,
      );
      return NextResponse.json({
        ok: true,
        election: publicElectionView(election),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新失敗";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const parsed = updateElectionSchema.safeParse(body);
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
    const election = await updateElectionMeta(parsed.data.electionId, {
      title: parsed.data.title,
      description: parsed.data.description,
      candidates: parsed.data.candidates,
    });
    return NextResponse.json({ ok: true, election: publicElectionView(election) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body: unknown = await request.json();
  const parsed = electionIdSchema.safeParse(body);
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

  const removed = await deleteElection(parsed.data.electionId);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "找不到此投票" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    electionId?: string;
    keepVoters?: boolean;
  };
  if (!body.electionId) {
    return NextResponse.json({ ok: false, error: "缺少投票編號" }, { status: 400 });
  }
  const access = await requireElectionManager(body.electionId);
  if (!access.ok) {
    return NextResponse.json(access, { status: 403 });
  }
  try {
    const election = await resetElection(
      body.electionId,
      body.keepVoters !== false,
    );
    return NextResponse.json({ ok: true, election: publicElectionView(election) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "重設失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
