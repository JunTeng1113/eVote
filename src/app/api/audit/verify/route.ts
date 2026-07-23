import { NextResponse } from "next/server";
import {
  findReceipt,
  findReceiptAnywhere,
  runUniversalAudit,
} from "@/lib/services/audit-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receipt = searchParams.get("receipt");
  const electionId = searchParams.get("electionId");

  if (receipt) {
    if (electionId) {
      try {
        return NextResponse.json(await findReceipt(electionId, receipt));
      } catch {
        return NextResponse.json({ found: false });
      }
    }
    return NextResponse.json(await findReceiptAnywhere(receipt));
  }

  if (!electionId) {
    return NextResponse.json(
      { ok: false, error: "缺少投票編號" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await runUniversalAudit(electionId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "稽核失敗";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
