# eVote

使用 Google 帳號登入的線上投票系統。資料儲存於 **PostgreSQL + Prisma**。

## 你需要先做的事

### 1. 啟動 PostgreSQL

若已安裝 Docker，在專案根目錄執行：

```bash
docker compose up -d
```

這會啟動本機 Postgres（帳密 `postgres` / `postgres`，資料庫 `evote`，埠 `5432`）。

若你使用自己的 PostgreSQL，請自行建立資料庫 `evote`。

### 2. 設定環境變數

複製範例並填入：

```bash
cp .env.example .env
cp .env.example .env.local
```

至少確認這兩個檔都有：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/evote?schema=public"
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_URL=http://localhost:3000
ADMIN_EMAILS=你的管理員@gmail.com
```

> Prisma CLI 讀 `.env`；Next.js 讀 `.env.local`。兩邊的 `DATABASE_URL` 請保持一致。

### 3. 安裝依賴、產生 Prisma Client、遷移資料表

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init_evote
```

### 4. 啟動網站

```bash
npm run dev
```

開啟 http://localhost:3000

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run db:up` | 啟動 Docker PostgreSQL |
| `npm run db:generate` | 產生 Prisma Client |
| `npm run db:migrate` | 建立／套用 migration |
| `npm run db:studio` | 開啟 Prisma Studio 看資料 |
| `npm run smoke` | 端到端煙霧測試（需 DB） |

## Google 登入

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 建立 OAuth 用戶端  
2. 重新導向 URI：`http://localhost:3000/api/auth/callback/google`  
3. 填入 `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`

## 使用者／管理流程

**投票權人**：登入 → `/vote` 選擇投票 → 送出 → `/confirm` 確認 → `/results` 看結果  

**投票管理**（任何登入使用者）：`/admin`  
- 建立新投票（建立者即為該場投票管理者）  
- 可新增共同管理者  
- 查看並管理自己建立／被授權的投票  

**系統管理者**（`ADMIN_EMAILS`）：可在 `/admin` 查看並管理**全部**投票  

## 技術備註

- 背景仍使用盲簽、ElGamal、ZKP、Mix-Net  
- 私鑰目前存於資料庫 JSON（示範用）；正式環境建議改放 KMS／HSM  
- 選項圖片存在 `public/uploads`（Vercel 等無狀態主機上無法持久保存；正式環境建議改接物件儲存）

## 部署到公開網路（Vercel + Neon）

### 1. 建立 Neon Postgres

1. 到 [Neon Console](https://console.neon.tech/) 建立專案  
2. 複製連線字串為 `DATABASE_URL`

本機可先驗證遷移：

```bash
# 暫時把 DATABASE_URL 設成 Neon 連線字串後執行
npx prisma migrate deploy
```

### 2. 部署到 Vercel

1. 把專案推上 GitHub  
2. 到 [Vercel](https://vercel.com/) Import 該儲存庫  
3. 設定環境變數（Production）：

```env
DATABASE_URL=（Neon 連線字串；應用程式可用 pooled）
DIRECT_URL=（選填，Neon 非 pooler 直連；遷移建議使用，未設時會自動去掉 -pooler）
AUTH_SECRET=（隨機字串，可用 openssl rand -base64 32）
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_URL=https://你的專案.vercel.app
AUTH_TRUST_HOST=true
ADMIN_EMAILS=你的管理員@gmail.com
```

> `prisma migrate deploy` 需要能取得 Postgres advisory lock。若 `DATABASE_URL` 是 Neon `-pooler` 位址，建置可能出現 `P1002` 逾時；請改設 `DIRECT_URL` 為不含 `-pooler` 的直連，或沿用本專案自動轉換。

4. Build Command 使用專案預設：`prisma generate && node scripts/migrate-deploy.mjs && next build`（遷移失敗會自動重試，以應付 Neon 冷啟動／lock）  
5. Deploy 完成後取得公開網址

### 3. 更新 Google OAuth

在 [Google Cloud Console](https://console.cloud.google.com/apis/credentials) 的 OAuth 用戶端新增：

- 授權的 JavaScript 來源：`https://你的專案.vercel.app`
- 授權重新導向 URI：`https://你的專案.vercel.app/api/auth/callback/google`

並確認 Vercel 的 `AUTH_URL` 與此網域一致。

