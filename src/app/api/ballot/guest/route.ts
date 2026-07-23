import { NextResponse } from "next/server";
import { clientIpFromRequest, hashVoterIp } from "@/lib/client-ip";
import { guestBallotSubmitSchema } from "@/lib/schemas/voting";
import {
  getGuestBallotStatus,
  submitGuestBallot,
} from "@/lib/services/ballot-service";

function resolveIpHash(request: Request, electionId: string) {
  const ip = clientIpFromRequest(request);
  if (!ip) {
    return null;
  }
  return hashVoterIp(electionId, ip);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json(
      { ok: false, error: "缺少投票編號" },
      { status: 400 },
    );
  }

  const ipHash = resolveIpHash(request, electionId);
  if (!ipHash) {
    return NextResponse.json(
      { ok: false, error: "無法辨識連線位址，請稍後再試" },
      { status: 400 },
    );
  }

  const result = await getGuestBallotStatus(electionId, ipHash);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = guestBallotSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "輸入無效" },
      { status: 400 },
    );
  }

  const ipHash = resolveIpHash(request, parsed.data.electionId);
  if (!ipHash) {
    return NextResponse.json(
      { ok: false, error: "無法辨識連線位址，請稍後再試" },
      { status: 400 },
    );
  }

  const result = await submitGuestBallot(
    parsed.data.electionId,
    ipHash,
    parsed.data.candidateId,
  );
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
