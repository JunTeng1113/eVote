import { NextResponse } from "next/server";
import { ballotSubmitSchema } from "@/lib/schemas/voting";
import { submitBallot } from "@/lib/services/ballot-service";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = ballotSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  try {
    const { electionId, ...ballot } = parsed.data;
    const result = await submitBallot(electionId, ballot);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
