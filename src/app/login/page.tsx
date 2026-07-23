import { Suspense } from "react";
import { isGoogleAuthConfigured } from "@/auth";
import { LoginClient } from "@/components/login-client";
import { Alert } from "@/components/ui/alert";

export default function LoginPage() {
  const configured = isGoogleAuthConfigured();

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
        登入
      </h1>
      {!configured ? (
        <Alert className="border-amber-300/60 bg-amber-50 text-amber-950">
          尚未設定 Google 登入。請在 `.env.local` 填入 `AUTH_GOOGLE_ID`、
          `AUTH_GOOGLE_SECRET`、`AUTH_SECRET` 與 `ADMIN_EMAILS` 後重新啟動。
        </Alert>
      ) : null}
      <Suspense
        fallback={
          <p className="text-sm text-[var(--muted-foreground)]">載入中…</p>
        }
      >
        <LoginClient googleEnabled={configured} />
      </Suspense>
    </div>
  );
}
