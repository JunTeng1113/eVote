import { prisma } from "@/lib/db";

/** 超過此時間未心跳視為離線。 */
export const ONLINE_WINDOW_MS = 60_000;

export async function heartbeatAndCountOnline(
  deviceId: string,
): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ONLINE_WINDOW_MS);

  await prisma.onlinePresence.upsert({
    where: { deviceId },
    create: { deviceId, lastSeenAt: now },
    update: { lastSeenAt: now },
  });

  await prisma.onlinePresence.deleteMany({
    where: { lastSeenAt: { lt: cutoff } },
  });

  return prisma.onlinePresence.count({
    where: { lastSeenAt: { gte: cutoff } },
  });
}

export async function countOnlineDevices(): Promise<number> {
  const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS);
  return prisma.onlinePresence.count({
    where: { lastSeenAt: { gte: cutoff } },
  });
}
