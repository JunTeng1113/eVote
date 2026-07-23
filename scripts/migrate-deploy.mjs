import { spawnSync } from "node:child_process";

const MAX_ATTEMPTS = 5;
const RETRY_MS = 8_000;

function trimEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function withConnectTimeout(url) {
  if (url.includes("connect_timeout=")) {
    return url;
  }
  return url.includes("?")
    ? `${url}&connect_timeout=30`
    : `${url}?connect_timeout=30`;
}

function resolveMigrateUrl() {
  const direct = trimEnv("DIRECT_URL");
  if (direct) {
    return withConnectTimeout(direct);
  }
  const databaseUrl = trimEnv("DATABASE_URL");
  if (!databaseUrl) {
    return undefined;
  }
  if (databaseUrl.includes("-pooler.") && databaseUrl.includes("neon.tech")) {
    return withConnectTimeout(databaseUrl.replace("-pooler.", "."));
  }
  return withConnectTimeout(databaseUrl);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const migrateUrl = resolveMigrateUrl();
if (!migrateUrl) {
  console.error("缺少 DATABASE_URL / DIRECT_URL，無法執行 migrate deploy。");
  process.exit(1);
}

process.env.DIRECT_URL = migrateUrl;
process.env.DATABASE_URL = migrateUrl;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  console.log(`prisma migrate deploy（第 ${attempt}/${MAX_ATTEMPTS} 次）`);
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
    shell: true,
  });
  if (result.status === 0) {
    process.exit(0);
  }
  if (attempt < MAX_ATTEMPTS) {
    console.warn(
      `migrate 失敗，${RETRY_MS / 1000}s 後重試（常見於 Neon 冷啟動或 advisory lock 忙碌）…`,
    );
    sleep(RETRY_MS);
  }
}

console.error("prisma migrate deploy 重試後仍失敗。");
process.exit(1);
