import { NextResponse } from "next/server";
import { blindSignRequestSchema } from "@/lib/schemas/voting";
import { issueBlindSignature } from "@/lib/services/credential-service";

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = blindSignRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }
  try {
    const result = await issueBlindSignature(
      parsed.data.electionId,
      parsed.data.authTicket,
      parsed.data.blindedMessage,
    );
    if (!result.ok) {
      return NextResponse.json(result, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "處理失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
