import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HomeResultPreviews } from "@/components/home-result-previews";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-14 sm:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(11,79,108,0.08),transparent_40%,rgba(27,122,110,0.1))]" />
        <div className="relative max-w-2xl space-y-5">
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--primary)] sm:text-6xl">
            eVote
          </h1>
          <p className="text-lg text-[var(--muted-foreground)]">
            使用 Google 帳號登入即可投票。管理員可同時舉辦多場投票，並分別設定可投票名單。
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/vote">前往投票</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/confirm">確認投票</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1. 登入</CardTitle>
            <CardDescription>用你的 Google 帳號登入。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. 選擇投票</CardTitle>
            <CardDescription>選一場你有資格的投票並送出。</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3. 確認</CardTitle>
            <CardDescription>
              用確認碼檢查系統是否有收到你的票。
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <HomeResultPreviews />

      <Card>
        <CardHeader>
          <CardTitle>隱私說明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <p>主辦單位可以知道誰有投票資格、誰已投票，但無法得知你投給誰。</p>
          <p>確認碼只用來證明「有投到」，不會顯示你的選擇。</p>
        </CardContent>
      </Card>
    </div>
  );
}
