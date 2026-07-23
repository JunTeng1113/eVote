import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const MAX_ATTEMPTS = 5;
const RETRY_MS = 8_000;
const PRISMA_ADVISORY_LOCK_KEY = 72707369;

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

function localMigrationNames() {
  const dir = join(process.cwd(), "prisma", "migrations");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

async function prepareDatabase(url) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SELECT 1");

  const lockHolders = await client.query(
    `
    SELECT l.pid, a.state, a.query, a.query_start, a.application_name
    FROM pg_locks l
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE l.locktype = 'advisory'
      AND a.pid <> pg_backend_pid()
      AND (
        l.objid = $1
        OR ((l.classid::bigint << 32) | l.objid::bigint) = $1::bigint
      )
    `,
    [PRISMA_ADVISORY_LOCK_KEY],
  );

  for (const row of lockHolders.rows) {
    const idleLongEnough =
      row.state === "idle" ||
      row.state === "idle in transaction" ||
      row.state === "idle in transaction (aborted)";
    if (!idleLongEnough) {
      continue;
    }
    console.warn(
      `終止持有 Prisma advisory lock 的閒置連線 pid=${row.pid}（${row.state}）`,
    );
    await client.query("SELECT pg_terminate_backend($1)", [row.pid]);
  }

  const applied = await client.query(
    `
    SELECT migration_name
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
    ORDER BY migration_name
    `,
  );
  await client.end();

  const appliedNames = new Set(applied.rows.map((row) => row.migration_name));
  const pending = localMigrationNames().filter((name) => !appliedNames.has(name));
  return { pending };
}

const migrateUrl = resolveMigrateUrl();
if (!migrateUrl) {
  console.error("缺少 DATABASE_URL / DIRECT_URL，無法執行 migrate deploy。");
  process.exit(1);
}

process.env.DIRECT_URL = migrateUrl;
process.env.DATABASE_URL = migrateUrl;

const prepared = await prepareDatabase(migrateUrl).then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error }),
);

if (!prepared.ok) {
  console.warn("預檢查資料庫失敗，改直接執行 migrate：", prepared.error);
} else if (prepared.value.pending.length === 0) {
  console.log("資料庫遷移已是最新，略過 prisma migrate deploy。");
  process.exit(0);
} else {
  console.log(
    `尚有 ${prepared.value.pending.length} 筆待套用遷移：${prepared.value.pending.join(", ")}`,
  );
}

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
