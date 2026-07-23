import { z } from "zod";

export const blindSignRequestSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
  authTicket: z.string().min(16),
  blindedMessage: z
    .string()
    .regex(/^[0-9a-fA-F]+$/, "盲化訊息須為十六進位"),
});

export const ballotSubmitSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
  ciphertext: z.object({
    c1: z.string().min(16),
    c2: z.string().min(16),
  }),
  ballotProof: z.object({
    commits: z.array(z.string()).min(1),
    challenges: z.array(z.string()).min(1),
    responses: z.array(z.string()).min(1),
  }),
  credentialProof: z.object({
    kind: z.literal("blind-sig-with-nullifier"),
    nullifier: z.string().min(16),
    messageHex: z.string().min(16),
    signatureHex: z.string().min(16),
  }),
});

export const voteChoiceSchema = z.object({
  candidateId: z.string().min(1, "請選擇一個選項"),
});

export const adminEmailsSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
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

export const removeEmailSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
  email: z.string().email("Email 格式不正確"),
});

export const candidateInputSchema = z.object({
  name: z.string().min(1, "選項名稱不可空白"),
  party: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const createElectionSchema = z
  .object({
    title: z.string().min(2, "請輸入投票標題").max(120),
    description: z.string().max(500).optional(),
    votingMode: z.enum(["anonymous", "named", "open"]).default("anonymous"),
    scheduleMode: z
      .enum(["unlimited", "timed", "duration"])
      .default("unlimited"),
    votingStartsAt: z.string().optional(),
    votingEndsAt: z.string().optional(),
    durationMinutes: z.number().int().optional(),
    candidates: z.array(candidateInputSchema).min(2, "至少需要 2 個選項"),
    voterEmails: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleMode === "duration") {
      const minutes = data.durationMinutes;
      if (
        typeof minutes !== "number" ||
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 30 * 24 * 60
      ) {
        ctx.addIssue({
          code: "custom",
          message: "限時投票需介於 1 分鐘至 30 天",
          path: ["durationMinutes"],
        });
      }
      return;
    }
    if (data.scheduleMode !== "timed") {
      return;
    }
    if (!data.votingStartsAt?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "請設定投票開始時間",
        path: ["votingStartsAt"],
      });
    }
    if (!data.votingEndsAt?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "請設定投票截止時間",
        path: ["votingEndsAt"],
      });
    }
    if (!data.votingStartsAt?.trim() || !data.votingEndsAt?.trim()) {
      return;
    }
    const start = new Date(data.votingStartsAt);
    const end = new Date(data.votingEndsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "投票時間格式無效",
        path: ["votingStartsAt"],
      });
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        message: "截止時間必須晚於開始時間",
        path: ["votingEndsAt"],
      });
    }
  });

export const namedBallotSubmitSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
  candidateId: z.string().min(1, "請選擇一個選項"),
});

export const guestBallotSubmitSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
  candidateId: z.string().min(1, "請選擇一個選項"),
});

export const updateElectionSchema = z.object({
  electionId: z.string().min(1),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  candidates: z.array(candidateInputSchema).min(2).optional(),
});

export const updateCandidateImageSchema = z.object({
  electionId: z.string().min(1),
  candidateId: z.string().min(1),
  imageUrl: z.string().nullable(),
});

export const electionIdSchema = z.object({
  electionId: z.string().min(1, "缺少投票編號"),
});

export type BlindSignRequest = z.infer<typeof blindSignRequestSchema>;
export type BallotSubmitInput = z.infer<typeof ballotSubmitSchema>;
