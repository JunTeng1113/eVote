import { generateBlindSignKeys } from "@/lib/crypto/blind-signature-server";
import { generateThresholdKeypair } from "@/lib/crypto/elgamal";
import type { ElGamalCiphertext } from "@/lib/crypto/elgamal";
import type {
  BallotValidityProof,
  CredentialPossessionProof,
} from "@/lib/crypto/zk-proof";
import type { MixServerProof } from "@/lib/crypto/mixnet";
import { prisma } from "@/lib/db";
import {
  formatDurationMinutes,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/lib/voting-schedule";
import {
  isGuestOpenMode,
  isNamedBallotMode,
  requiresEligibleList,
  type VotingMode,
} from "@/lib/voting-mode";
import {
  Prisma,
  type Election as DbElection,
  type ElectionPhase as DbElectionPhase,
} from "@/generated/prisma/client";

export type { VotingMode };
export type ElectionPhase = "voting" | "closed" | "mixing" | "tallied";
export type ScheduleMode = "unlimited" | "timed" | "duration";

export type Candidate = {
  id: string;
  name: string;
  party: string;
  imageUrl: string | null;
};

export type VoterRecord = {
  email: string;
  displayName: string;
  authorized: boolean;
  authTicketHash: string | null;
  authorizedAt: string | null;
};

export type AuthTicketRecord = {
  ticket: string;
  voterId: string;
  consumed: boolean;
  createdAt: string;
};

export type SubmittedBallot = {
  index: number;
  ciphertext: ElGamalCiphertext;
  ballotProof: BallotValidityProof;
  credentialProof: CredentialPossessionProof;
  nullifier: string;
  receiptHash: string;
  submittedAt: string;
};

export type NamedBallotRecord = {
  voterEmail: string;
  candidateId: string;
  receiptHash: string;
  submittedAt: string;
};

export type GuestBallotRecord = {
  ipHash: string;
  candidateId: string;
  receiptHash: string;
  submittedAt: string;
};

export type TallyResult = {
  counts: Record<string, number>;
  total: number;
  mixLayers: ElGamalCiphertext[][];
  mixedCiphertexts: ElGamalCiphertext[];
  mixProofs: MixServerProof[];
  decryptionProofs: Array<{
    ciphertext: ElGamalCiphertext;
    candidateId: string;
    proof: {
      challenge: string;
      response: string;
      plaintextCommit: string;
    };
  }>;
  namedVotes?: Array<{ email: string; candidateId: string }>;
  talliedAt: string;
};

export type ElectionState = {
  electionId: string;
  title: string;
  description: string;
  phase: ElectionPhase;
  votingMode: VotingMode;
  scheduleMode: ScheduleMode;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  createdByEmail: string | null;
  managerEmails: string[];
  candidates: Candidate[];
  voters: VoterRecord[];
  authTickets: AuthTicketRecord[];
  ballots: SubmittedBallot[];
  namedBallots: NamedBallotRecord[];
  guestBallots: GuestBallotRecord[];
  nullifiers: string[];
  issuer: ReturnType<typeof generateBlindSignKeys>;
  threshold: {
    publicKey: { pkHex: string };
    masterSecret: { skHex: string };
    shares: Array<{ id: number; skShareHex: string }>;
    trusteeCount: number;
    thresholdK: number;
  };
  mixServers: string[];
  tally: TallyResult | null;
  createdAt: string;
};

export type CreateElectionInput = {
  title: string;
  description?: string;
  votingMode?: VotingMode;
  scheduleMode?: ScheduleMode;
  votingStartsAt?: string | null;
  votingEndsAt?: string | null;
  durationMinutes?: number;
  createdByEmail: string;
  candidates: Array<{ name: string; party?: string; imageUrl?: string | null }>;
  voterEmails?: string[];
};

type ElectionWithRelations = DbElection & {
  candidates: Array<{
    key: string;
    name: string;
    party: string;
    imageUrl: string | null;
    sortOrder: number;
  }>;
  voters: Array<{
    email: string;
    displayName: string;
    authorized: boolean;
    authTicketHash: string | null;
    authorizedAt: Date | null;
  }>;
  authTickets: Array<{
    ticket: string;
    voterId: string;
    consumed: boolean;
    createdAt: Date;
  }>;
  ballots: Array<{
    index: number;
    ciphertext: Prisma.JsonValue;
    ballotProof: Prisma.JsonValue;
    credentialProof: Prisma.JsonValue;
    nullifier: string;
    receiptHash: string;
    submittedAt: Date;
  }>;
  namedBallots: Array<{
    voterEmail: string;
    candidateKey: string;
    receiptHash: string;
    submittedAt: Date;
  }>;
  guestBallots: Array<{
    ipHash: string;
    candidateKey: string;
    receiptHash: string;
    submittedAt: Date;
  }>;
  managers: Array<{
    email: string;
  }>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function newElectionId(): string {
  return `election-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function asJson<T>(value: Prisma.JsonValue): T {
  return value as T;
}

function mapElection(row: ElectionWithRelations): ElectionState {
  const ballots = row.ballots
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((b) => ({
      index: b.index,
      ciphertext: asJson<ElGamalCiphertext>(b.ciphertext),
      ballotProof: asJson<BallotValidityProof>(b.ballotProof),
      credentialProof: asJson<CredentialPossessionProof>(b.credentialProof),
      nullifier: b.nullifier,
      receiptHash: b.receiptHash,
      submittedAt: b.submittedAt.toISOString(),
    }));

  return {
    electionId: row.electionId,
    title: row.title,
    description: row.description,
    phase: row.phase as ElectionPhase,
    votingMode: (row.votingMode as VotingMode) ?? "anonymous",
    scheduleMode: (row.scheduleMode as ScheduleMode) ?? "unlimited",
    votingStartsAt: row.votingStartsAt
      ? row.votingStartsAt.toISOString()
      : null,
    votingEndsAt: row.votingEndsAt ? row.votingEndsAt.toISOString() : null,
    createdByEmail: row.createdByEmail ?? null,
    managerEmails: row.managers.map((m) => m.email),
    candidates: row.candidates
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => ({
        id: c.key,
        name: c.name,
        party: c.party,
        imageUrl: c.imageUrl,
      })),
    voters: row.voters.map((v) => ({
      email: v.email,
      displayName: v.displayName,
      authorized: v.authorized,
      authTicketHash: v.authTicketHash,
      authorizedAt: v.authorizedAt ? v.authorizedAt.toISOString() : null,
    })),
    authTickets: row.authTickets.map((t) => ({
      ticket: t.ticket,
      voterId: t.voterId,
      consumed: t.consumed,
      createdAt: t.createdAt.toISOString(),
    })),
    ballots,
    namedBallots: row.namedBallots.map((b) => ({
      voterEmail: b.voterEmail,
      candidateId: b.candidateKey,
      receiptHash: b.receiptHash,
      submittedAt: b.submittedAt.toISOString(),
    })),
    guestBallots: row.guestBallots.map((b) => ({
      ipHash: b.ipHash,
      candidateId: b.candidateKey,
      receiptHash: b.receiptHash,
      submittedAt: b.submittedAt.toISOString(),
    })),
    nullifiers: ballots.map((b) => b.nullifier),
    issuer: asJson(row.issuer),
    threshold: asJson(row.threshold),
    mixServers: asJson<string[]>(row.mixServers),
    tally: row.tally ? asJson<TallyResult>(row.tally) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

const electionInclude = {
  candidates: true,
  voters: true,
  authTickets: true,
  ballots: true,
  namedBallots: true,
  guestBallots: true,
  managers: true,
} as const;

async function loadElectionRow(
  electionId: string,
): Promise<ElectionWithRelations | null> {
  return prisma.election.findUnique({
    where: { electionId },
    include: electionInclude,
  });
}

export async function listElections(): Promise<ElectionState[]> {
  const rows = await prisma.election.findMany({
    include: electionInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapElection);
}

export async function listManagedElections(
  email: string,
  isSystemAdmin: boolean,
): Promise<ElectionState[]> {
  if (isSystemAdmin) {
    return listElections();
  }
  const normalized = normalizeEmail(email);
  const rows = await prisma.election.findMany({
    where: {
      OR: [
        { createdByEmail: normalized },
        { managers: { some: { email: normalized } } },
      ],
    },
    include: electionInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapElection);
}

/** 管理列表用：只取摘要欄位與計數，避免一次載入選票／圖片。 */
export type ManagedElectionListItem = {
  electionId: string;
  title: string;
  description: string;
  phase: ElectionPhase;
  votingMode: VotingMode;
  scheduleMode: ScheduleMode;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  createdByEmail: string | null;
  managerEmails: string[];
  candidateCount: number;
  eligibleVoters: number;
  ballotCount: number;
  createdAt: string;
  hasResult: boolean;
};

export async function listManagedElectionSummaries(
  email: string,
  isSystemAdmin: boolean,
): Promise<ManagedElectionListItem[]> {
  const normalized = normalizeEmail(email);
  const rows = await prisma.election.findMany({
    where: isSystemAdmin
      ? undefined
      : {
          OR: [
            { createdByEmail: normalized },
            { managers: { some: { email: normalized } } },
          ],
        },
    select: {
      electionId: true,
      title: true,
      description: true,
      phase: true,
      votingMode: true,
      scheduleMode: true,
      votingStartsAt: true,
      votingEndsAt: true,
      createdByEmail: true,
      createdAt: true,
      tally: true,
      managers: { select: { email: true } },
      _count: {
        select: {
          candidates: true,
          voters: true,
          ballots: true,
          namedBallots: true,
          guestBallots: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => {
    const votingMode = (row.votingMode as VotingMode) ?? "anonymous";
    const ballotCount = isNamedBallotMode(votingMode)
      ? row._count.namedBallots
      : isGuestOpenMode(votingMode)
        ? row._count.guestBallots
        : row._count.ballots;
    return {
      electionId: row.electionId,
      title: row.title,
      description: row.description,
      phase: row.phase as ElectionPhase,
      votingMode,
      scheduleMode: (row.scheduleMode as ScheduleMode) ?? "unlimited",
      votingStartsAt: row.votingStartsAt
        ? row.votingStartsAt.toISOString()
        : null,
      votingEndsAt: row.votingEndsAt ? row.votingEndsAt.toISOString() : null,
      createdByEmail: row.createdByEmail,
      managerEmails: row.managers.map((m) => m.email),
      candidateCount: row._count.candidates,
      eligibleVoters: requiresEligibleList(votingMode) ? row._count.voters : 0,
      ballotCount,
      createdAt: row.createdAt.toISOString(),
      hasResult: row.tally !== null,
    };
  });
}

export function canManageElection(
  election: Pick<ElectionState, "createdByEmail" | "managerEmails">,
  email: string,
  isSystemAdmin: boolean,
): boolean {
  if (isSystemAdmin) {
    return true;
  }
  const normalized = normalizeEmail(email);
  if (election.createdByEmail === normalized) {
    return true;
  }
  return election.managerEmails.includes(normalized);
}

export async function getElection(
  electionId: string,
): Promise<ElectionState | null> {
  const row = await loadElectionRow(electionId);
  return row ? mapElection(row) : null;
}

export async function requireElection(
  electionId: string,
): Promise<ElectionState> {
  const election = await getElection(electionId);
  if (!election) {
    throw new Error("找不到此投票");
  }
  return election;
}

function buildCryptoPayload() {
  const issuer = generateBlindSignKeys();
  const threshold = generateThresholdKeypair(3, 2);
  return {
    issuer,
    threshold: {
      publicKey: threshold.publicKey,
      masterSecret: threshold.masterSecret,
      shares: threshold.shares,
      trusteeCount: 3,
      thresholdK: 2,
    },
    mixServers: ["mix-1", "mix-2", "mix-3"],
  };
}

function buildCandidatesInput(
  candidates: CreateElectionInput["candidates"],
): Array<{
  key: string;
  name: string;
  party: string;
  imageUrl: string | null;
  sortOrder: number;
}> {
  return candidates.map((c, index) => ({
    key: `c${index + 1}`,
    name: c.name.trim(),
    party: (c.party ?? "").trim(),
    imageUrl: c.imageUrl?.trim() || null,
    sortOrder: index,
  }));
}

function buildVotersInput(emails: string[] | undefined) {
  const seen = new Set<string>();
  const voters = [];
  for (const raw of emails ?? []) {
    const email = normalizeEmail(raw);
    if (!email.includes("@") || seen.has(email)) {
      continue;
    }
    seen.add(email);
    voters.push({
      email,
      displayName: email.split("@")[0] ?? email,
    });
  }
  return voters;
}

function resolveScheduleFields(input: {
  scheduleMode?: ScheduleMode;
  votingStartsAt?: string | null;
  votingEndsAt?: string | null;
  durationMinutes?: number;
}): {
  scheduleMode: ScheduleMode;
  votingStartsAt: Date | null;
  votingEndsAt: Date | null;
} {
  if (input.scheduleMode === "timed") {
    if (!input.votingStartsAt || !input.votingEndsAt) {
      throw new Error("計時投票需設定開始與截止時間");
    }
    const start = new Date(input.votingStartsAt);
    const end = new Date(input.votingEndsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("投票時間格式無效");
    }
    if (end <= start) {
      throw new Error("截止時間必須晚於開始時間");
    }
    return {
      scheduleMode: "timed",
      votingStartsAt: start,
      votingEndsAt: end,
    };
  }
  if (input.scheduleMode === "duration") {
    const minutes = input.durationMinutes;
    if (
      typeof minutes !== "number" ||
      !Number.isInteger(minutes) ||
      minutes < MIN_DURATION_MINUTES ||
      minutes > MAX_DURATION_MINUTES
    ) {
      throw new Error(
        `限時投票需介於 ${formatDurationMinutes(MIN_DURATION_MINUTES)} 至 ${formatDurationMinutes(MAX_DURATION_MINUTES)}`,
      );
    }
    const votingStartsAt = new Date();
    return {
      scheduleMode: "duration",
      votingStartsAt,
      votingEndsAt: new Date(votingStartsAt.getTime() + minutes * 60_000),
    };
  }
  return {
    scheduleMode: "unlimited",
    votingStartsAt: null,
    votingEndsAt: null,
  };
}

function normalizeVotingMode(mode: VotingMode | undefined): VotingMode {
  if (mode === "named") {
    return "named";
  }
  if (mode === "named_open") {
    return "named_open";
  }
  if (mode === "open") {
    return "open";
  }
  return "anonymous";
}

export async function createElection(
  input: CreateElectionInput,
): Promise<ElectionState> {
  if (!input.title.trim()) {
    throw new Error("請輸入投票標題");
  }
  if (input.candidates.length < 2) {
    throw new Error("至少需要 2 個選項");
  }
  if (input.candidates.some((c) => !c.name.trim())) {
    throw new Error("選項名稱不可空白");
  }

  const schedule = resolveScheduleFields(input);
  const votingMode = normalizeVotingMode(input.votingMode);
  const crypto = buildCryptoPayload();
  const electionId = newElectionId();
  const candidates = buildCandidatesInput(input.candidates);
  const voters = buildVotersInput(input.voterEmails);
  const creatorEmail = normalizeEmail(input.createdByEmail);

  await prisma.election.create({
    data: {
      electionId,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      phase: "voting",
      votingMode,
      scheduleMode: schedule.scheduleMode,
      votingStartsAt: schedule.votingStartsAt,
      votingEndsAt: schedule.votingEndsAt,
      createdByEmail: creatorEmail,
      mixServers: crypto.mixServers,
      issuer: crypto.issuer as unknown as Prisma.InputJsonValue,
      threshold: crypto.threshold as unknown as Prisma.InputJsonValue,
      candidates: { create: candidates },
      voters: {
        create: requiresEligibleList(votingMode) ? voters : [],
      },
      managers: { create: [{ email: creatorEmail }] },
    },
  });

  return requireElection(electionId);
}

export async function updateElectionMeta(
  electionId: string,
  patch: {
    title?: string;
    description?: string;
    candidates?: Array<{
      name: string;
      party?: string;
      imageUrl?: string | null;
    }>;
  },
): Promise<ElectionState> {
  const election = await requireElection(electionId);
  if (
    election.ballots.length > 0 ||
    election.namedBallots.length > 0 ||
    election.guestBallots.length > 0
  ) {
    throw new Error("已有人投票，無法修改選項與基本資料");
  }
  if (election.phase !== "voting") {
    throw new Error("僅投票進行中且尚未有選票時可修改");
  }

  await prisma.$transaction(async (tx) => {
    await tx.election.update({
      where: { electionId },
      data: {
        title:
          typeof patch.title === "string" && patch.title.trim()
            ? patch.title.trim()
            : undefined,
        description:
          typeof patch.description === "string"
            ? patch.description.trim()
            : undefined,
      },
    });

    if (patch.candidates) {
      if (patch.candidates.length < 2) {
        throw new Error("至少需要 2 個選項");
      }
      await tx.candidate.deleteMany({ where: { electionId } });
      await tx.candidate.createMany({
        data: buildCandidatesInput(patch.candidates).map((c) => ({
          ...c,
          electionId,
        })),
      });
    }
  });

  return requireElection(electionId);
}

/**
 * 修改投票設定並重設選票（回到投票中）。
 * 允許 voting／closed；開票中或已開票請先重設。
 */
export async function reviseElectionSettings(
  electionId: string,
  input: Omit<CreateElectionInput, "createdByEmail" | "voterEmails">,
): Promise<ElectionState> {
  const previous = await requireElection(electionId);
  if (previous.phase === "mixing" || previous.phase === "tallied") {
    throw new Error("開票中或已開票後無法修改設定，請先重設此投票");
  }
  if (!input.title.trim()) {
    throw new Error("請輸入投票標題");
  }
  if (input.candidates.length < 2) {
    throw new Error("至少需要 2 個選項");
  }
  if (input.candidates.some((c) => !c.name.trim())) {
    throw new Error("選項名稱不可空白");
  }

  const schedule = resolveScheduleFields(input);
  const votingMode = normalizeVotingMode(input.votingMode);
  const crypto = buildCryptoPayload();
  const candidates = buildCandidatesInput(input.candidates);
  const voters = requiresEligibleList(votingMode)
    ? previous.voters.map((v) => ({
        email: v.email,
        displayName: v.displayName,
      }))
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.guestBallot.deleteMany({ where: { electionId } });
    await tx.namedBallot.deleteMany({ where: { electionId } });
    await tx.ballot.deleteMany({ where: { electionId } });
    await tx.authTicket.deleteMany({ where: { electionId } });
    await tx.eligibleVoter.deleteMany({ where: { electionId } });
    await tx.candidate.deleteMany({ where: { electionId } });
    await tx.election.update({
      where: { electionId },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() ?? "",
        phase: "voting",
        votingMode,
        scheduleMode: schedule.scheduleMode,
        votingStartsAt: schedule.votingStartsAt,
        votingEndsAt: schedule.votingEndsAt,
        tally: Prisma.DbNull,
        mixServers: crypto.mixServers,
        issuer: crypto.issuer as unknown as Prisma.InputJsonValue,
        threshold: crypto.threshold as unknown as Prisma.InputJsonValue,
        candidates: { create: candidates },
        voters: { create: voters },
      },
    });
  });

  return requireElection(electionId);
}

export async function updateCandidateImage(
  electionId: string,
  candidateId: string,
  imageUrl: string | null,
): Promise<ElectionState> {
  const election = await requireElection(electionId);
  if (
    election.ballots.length > 0 ||
    election.namedBallots.length > 0 ||
    election.guestBallots.length > 0
  ) {
    throw new Error("已有人投票，無法再變更選項圖片");
  }
  const result = await prisma.candidate.updateMany({
    where: { electionId, key: candidateId },
    data: { imageUrl },
  });
  if (result.count === 0) {
    throw new Error("找不到此選項");
  }
  return requireElection(electionId);
}

export async function deleteElection(electionId: string): Promise<boolean> {
  const result = await prisma.election.deleteMany({ where: { electionId } });
  return result.count > 0;
}

export async function resetElection(
  electionId: string,
  keepVoters = true,
): Promise<ElectionState> {
  const previous = await requireElection(electionId);
  const crypto = buildCryptoPayload();
  const candidates = previous.candidates.map((c, index) => ({
    key: `c${index + 1}`,
    name: c.name,
    party: c.party,
    imageUrl: c.imageUrl,
    sortOrder: index,
  }));
  const voters = keepVoters
    ? previous.voters.map((v) => ({
        email: v.email,
        displayName: v.displayName,
      }))
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.guestBallot.deleteMany({ where: { electionId } });
    await tx.namedBallot.deleteMany({ where: { electionId } });
    await tx.ballot.deleteMany({ where: { electionId } });
    await tx.authTicket.deleteMany({ where: { electionId } });
    await tx.eligibleVoter.deleteMany({ where: { electionId } });
    await tx.candidate.deleteMany({ where: { electionId } });
    await tx.election.update({
      where: { electionId },
      data: {
        phase: "voting",
        votingMode: previous.votingMode,
        scheduleMode: previous.scheduleMode,
        votingStartsAt: previous.votingStartsAt
          ? new Date(previous.votingStartsAt)
          : null,
        votingEndsAt: previous.votingEndsAt
          ? new Date(previous.votingEndsAt)
          : null,
        tally: Prisma.DbNull,
        mixServers: crypto.mixServers,
        issuer: crypto.issuer as unknown as Prisma.InputJsonValue,
        threshold: crypto.threshold as unknown as Prisma.InputJsonValue,
        candidates: { create: candidates },
        voters: {
          create: requiresEligibleList(previous.votingMode) ? voters : [],
        },
      },
    });
  });

  return requireElection(electionId);
}

/** 煙霧測試：清空並建立一場 */
export async function resetElectionStore(
  keepVoters = false,
): Promise<ElectionState> {
  const first = await prisma.election.findFirst({
    orderBy: { createdAt: "desc" },
    include: { voters: true },
  });
  const previousVoters = keepVoters
    ? first?.voters.map((v) => v.email) ?? []
    : [];
  await prisma.election.deleteMany();
  return createElection({
    title: "是否延長圖書館開放時間",
    description: "針對延長平日閉館時間至晚間 10 點進行表決。請使用 Google 帳號登入後投票。",
    createdByEmail: "admin@example.com",
    candidates: [
      { name: "同意" },
      { name: "不同意" },
      { name: "棄權" },
    ],
    voterEmails: previousVoters,
  });
}

export async function listElectionManagers(
  electionId: string,
): Promise<Array<{ email: string; isCreator: boolean }>> {
  const election = await requireElection(electionId);
  const emails = new Set(election.managerEmails);
  if (election.createdByEmail) {
    emails.add(election.createdByEmail);
  }
  return Array.from(emails)
    .sort()
    .map((email) => ({
      email,
      isCreator: email === election.createdByEmail,
    }));
}

export async function addElectionManagers(
  electionId: string,
  emails: string[],
): Promise<{ added: string[]; skipped: string[] }> {
  await requireElection(electionId);
  const added: string[] = [];
  const skipped: string[] = [];
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email.includes("@")) {
      skipped.push(raw);
      continue;
    }
    try {
      await prisma.electionManager.create({
        data: { electionId, email },
      });
      added.push(email);
    } catch {
      skipped.push(email);
    }
  }
  return { added, skipped };
}

export async function removeElectionManager(
  electionId: string,
  email: string,
): Promise<boolean> {
  const election = await requireElection(electionId);
  const normalized = normalizeEmail(email);
  if (election.createdByEmail === normalized) {
    throw new Error("無法移除投票建立者");
  }
  const result = await prisma.electionManager.deleteMany({
    where: { electionId, email: normalized },
  });
  return result.count > 0;
}

export async function findVoterByEmail(
  electionId: string,
  email: string,
): Promise<VoterRecord | undefined> {
  const voter = await prisma.eligibleVoter.findUnique({
    where: {
      electionId_email: {
        electionId,
        email: normalizeEmail(email),
      },
    },
  });
  if (!voter) {
    return undefined;
  }
  return {
    email: voter.email,
    displayName: voter.displayName,
    authorized: voter.authorized,
    authTicketHash: voter.authTicketHash,
    authorizedAt: voter.authorizedAt ? voter.authorizedAt.toISOString() : null,
  };
}

export async function addEligibleEmails(
  electionId: string,
  emails: string[],
  displayNameByEmail?: Record<string, string>,
): Promise<{ added: string[]; skipped: string[] }> {
  await requireElection(electionId);
  const added: string[] = [];
  const skipped: string[] = [];

  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email.includes("@")) {
      skipped.push(raw);
      continue;
    }
    try {
      await prisma.eligibleVoter.create({
        data: {
          electionId,
          email,
          displayName:
            displayNameByEmail?.[email] ?? email.split("@")[0] ?? email,
        },
      });
      added.push(email);
    } catch {
      skipped.push(email);
    }
  }

  return { added, skipped };
}

export async function removeEligibleEmail(
  electionId: string,
  email: string,
): Promise<boolean> {
  const voter = await findVoterByEmail(electionId, email);
  if (!voter) {
    return false;
  }
  if (voter.authorized) {
    return false;
  }
  const result = await prisma.eligibleVoter.deleteMany({
    where: { electionId, email: normalizeEmail(email) },
  });
  return result.count > 0;
}

export async function saveAuthTicketIssue(input: {
  electionId: string;
  email: string;
  ticket: string;
  authTicketHash: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const voter = await tx.eligibleVoter.findUnique({
      where: {
        electionId_email: {
          electionId: input.electionId,
          email: normalizeEmail(input.email),
        },
      },
    });
    if (!voter || voter.authorized) {
      throw new Error("無法發行投票權");
    }
    await tx.eligibleVoter.update({
      where: { id: voter.id },
      data: {
        authorized: true,
        authTicketHash: input.authTicketHash,
        authorizedAt: new Date(),
      },
    });
    await tx.authTicket.create({
      data: {
        electionId: input.electionId,
        ticket: input.ticket,
        voterId: normalizeEmail(input.email),
        consumed: false,
      },
    });
  });
}

export async function consumeAuthTicket(
  electionId: string,
  ticket: string,
): Promise<boolean> {
  const result = await prisma.authTicket.updateMany({
    where: { electionId, ticket, consumed: false },
    data: { consumed: true },
  });
  return result.count > 0;
}

export async function findAuthTicket(electionId: string, ticket: string) {
  return prisma.authTicket.findFirst({
    where: { electionId, ticket },
  });
}

export async function saveBallot(
  electionId: string,
  ballot: SubmittedBallot,
): Promise<void> {
  await prisma.ballot.create({
    data: {
      electionId,
      index: ballot.index,
      ciphertext: ballot.ciphertext as unknown as Prisma.InputJsonValue,
      ballotProof: ballot.ballotProof as unknown as Prisma.InputJsonValue,
      credentialProof:
        ballot.credentialProof as unknown as Prisma.InputJsonValue,
      nullifier: ballot.nullifier,
      receiptHash: ballot.receiptHash,
      submittedAt: new Date(ballot.submittedAt),
    },
  });
}

export async function saveNamedBallot(input: {
  electionId: string;
  voterEmail: string;
  candidateId: string;
  receiptHash: string;
  requireEligibleList?: boolean;
}): Promise<void> {
  const email = normalizeEmail(input.voterEmail);
  const requireList = input.requireEligibleList !== false;
  await prisma.$transaction(async (tx) => {
    if (requireList) {
      const voter = await tx.eligibleVoter.findUnique({
        where: {
          electionId_email: {
            electionId: input.electionId,
            email,
          },
        },
      });
      if (!voter) {
        throw new Error("你的帳號不在本次可投票名單中");
      }
      if (voter.authorized) {
        throw new Error("你已經投過票了");
      }
      await tx.namedBallot.create({
        data: {
          electionId: input.electionId,
          voterEmail: email,
          candidateKey: input.candidateId,
          receiptHash: input.receiptHash,
        },
      });
      await tx.eligibleVoter.update({
        where: { id: voter.id },
        data: {
          authorized: true,
          authorizedAt: new Date(),
        },
      });
      return;
    }

    const existing = await tx.namedBallot.findUnique({
      where: {
        electionId_voterEmail: {
          electionId: input.electionId,
          voterEmail: email,
        },
      },
    });
    if (existing) {
      throw new Error("你已經投過票了");
    }
    await tx.namedBallot.create({
      data: {
        electionId: input.electionId,
        voterEmail: email,
        candidateKey: input.candidateId,
        receiptHash: input.receiptHash,
      },
    });
  });
}

export async function findNamedBallotByEmail(
  electionId: string,
  email: string,
) {
  return prisma.namedBallot.findUnique({
    where: {
      electionId_voterEmail: {
        electionId,
        voterEmail: normalizeEmail(email),
      },
    },
  });
}

export async function findGuestBallotByIpHash(
  electionId: string,
  ipHash: string,
) {
  return prisma.guestBallot.findUnique({
    where: {
      electionId_ipHash: {
        electionId,
        ipHash,
      },
    },
  });
}

export async function saveGuestBallot(input: {
  electionId: string;
  ipHash: string;
  candidateId: string;
  receiptHash: string;
}): Promise<void> {
  await prisma.guestBallot.create({
    data: {
      electionId: input.electionId,
      ipHash: input.ipHash,
      candidateKey: input.candidateId,
      receiptHash: input.receiptHash,
    },
  });
}

export async function countBallots(electionId: string): Promise<number> {
  return prisma.ballot.count({ where: { electionId } });
}

export async function countSubmittedVotes(electionId: string): Promise<number> {
  const election = await prisma.election.findUnique({
    where: { electionId },
    select: { votingMode: true },
  });
  if (election && isNamedBallotMode(election.votingMode)) {
    return prisma.namedBallot.count({ where: { electionId } });
  }
  if (election && isGuestOpenMode(election.votingMode)) {
    return prisma.guestBallot.count({ where: { electionId } });
  }
  return prisma.ballot.count({ where: { electionId } });
}

export async function updateElectionPhase(
  electionId: string,
  phase: ElectionPhase,
): Promise<void> {
  await prisma.election.update({
    where: { electionId },
    data: { phase: phase as DbElectionPhase },
  });
}

export async function saveTallyResult(
  electionId: string,
  tally: TallyResult,
): Promise<void> {
  await prisma.election.update({
    where: { electionId },
    data: {
      phase: "tallied",
      tally: tally as unknown as Prisma.InputJsonValue,
    },
  });
}

export function publicElectionView(state: ElectionState) {
  const ballotCount = isNamedBallotMode(state.votingMode)
    ? state.namedBallots.length
    : isGuestOpenMode(state.votingMode)
      ? state.guestBallots.length
      : state.ballots.length;
  const authorizedCount = isGuestOpenMode(state.votingMode)
    ? state.guestBallots.length
    : isNamedBallotMode(state.votingMode) &&
        !requiresEligibleList(state.votingMode)
      ? state.namedBallots.length
      : state.voters.filter((v) => v.authorized).length;
  return {
    electionId: state.electionId,
    title: state.title,
    description: state.description,
    phase: state.phase,
    votingMode: state.votingMode,
    scheduleMode: state.scheduleMode,
    votingStartsAt: state.votingStartsAt,
    votingEndsAt: state.votingEndsAt,
    createdByEmail: state.createdByEmail,
    managerEmails: state.managerEmails,
    candidates: state.candidates,
    createdAt: state.createdAt,
    stats: {
      eligibleVoters: requiresEligibleList(state.votingMode)
        ? state.voters.length
        : 0,
      authorizedCount,
      ballotCount,
    },
    crypto: {
      elgamalPk: state.threshold.publicKey.pkHex,
      issuerN: state.issuer.n,
      issuerE: state.issuer.e,
      mixServers: state.mixServers,
      thresholdK: state.threshold.thresholdK,
      trusteeCount: state.threshold.trusteeCount,
    },
    tally: state.tally
      ? {
          counts: state.tally.counts,
          total: state.tally.total,
          talliedAt: state.tally.talliedAt,
          mixProofCount: state.tally.mixProofs.length,
          decryptionProofCount: state.tally.decryptionProofs.length,
          namedVotes: state.tally.namedVotes,
        }
      : null,
  };
}

export function electionSummary(state: ElectionState) {
  const ballotCount = isNamedBallotMode(state.votingMode)
    ? state.namedBallots.length
    : isGuestOpenMode(state.votingMode)
      ? state.guestBallots.length
      : state.ballots.length;
  return {
    electionId: state.electionId,
    title: state.title,
    description: state.description,
    phase: state.phase,
    votingMode: state.votingMode,
    scheduleMode: state.scheduleMode,
    votingStartsAt: state.votingStartsAt,
    votingEndsAt: state.votingEndsAt,
    createdByEmail: state.createdByEmail,
    managerEmails: state.managerEmails,
    candidateCount: state.candidates.length,
    eligibleVoters: requiresEligibleList(state.votingMode)
      ? state.voters.length
      : 0,
    ballotCount,
    createdAt: state.createdAt,
    hasResult: Boolean(state.tally),
  };
}

export function phaseLabel(phase: ElectionPhase): string {
  switch (phase) {
    case "voting":
      return "投票中";
    case "closed":
      return "已截止";
    case "mixing":
      return "開票中";
    case "tallied":
      return "已開票";
    default:
      return phase;
  }
}

export { normalizeEmail };
export { Prisma };
