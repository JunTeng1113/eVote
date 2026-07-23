import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";
import { namedBallotSubmitSchema } from "@/lib/schemas/voting";
import { submitNamedBallot } from "@/lib/services/ballot-service";

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (!user.ok || !user.email) {
    return NextResponse.json(
      { ok: false, error: user.error ?? "請先登入" },
      { status: 401 },
    );
  }

  const body: unknown = await request.json();
  const parsed = namedBallotSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }

  try {
    const result = await submitNamedBallot(
      parsed.data.electionId,
      user.email,
      parsed.data.candidateId,
    );
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
