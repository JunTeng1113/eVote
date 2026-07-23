import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** 變更 schema 後請遞增，避免 dev 熱重載沿用舊 PrismaClient 單例。 */
const PRISMA_CLIENT_GEN = "guest-open-voting-v1";

const globalForPrisma = globalThis as unknown as {
  __evotePrisma?: PrismaClient;
  __evotePrismaGen?: string;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "缺少 DATABASE_URL。請在 .env 與 .env.local 設定 PostgreSQL 連線字串。",
    );
  }
  if (connectionString.startsWith("prisma+postgres://")) {
    throw new Error(
      "請改用標準 PostgreSQL 連線字串，例如 postgresql://postgres:postgres@localhost:5432/evote",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

if (globalForPrisma.__evotePrismaGen !== PRISMA_CLIENT_GEN) {
  globalForPrisma.__evotePrisma = undefined;
  globalForPrisma.__evotePrismaGen = PRISMA_CLIENT_GEN;
}

export const prisma = globalForPrisma.__evotePrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__evotePrisma = prisma;
}
