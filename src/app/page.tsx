import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CreateVoteSystemPreview,
  ProjectionSystemPreview,
  ResultsSystemPreview,
} from "@/components/home-system-previews";

function ValueProposition({
  title,
  description,
  preview,
}: {
  title: string;
  description: string;
  preview: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)] sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
          {description}
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl">{preview}</div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="home-fade-up relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-12 sm:px-10 sm:py-16">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(11,79,108,0.1),transparent_42%,rgba(27,122,110,0.12))]" />
        <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-[rgba(27,122,110,0.12)] blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[rgba(11,79,108,0.1)] blur-3xl" />

        <div className="relative max-w-2xl space-y-6">
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--primary)] sm:text-6xl lg:text-7xl">
            eVote
          </h1>
          <p className="home-fade-up home-fade-up-delay-1 text-lg leading-relaxed text-[var(--foreground)] sm:text-xl">
            讓每個人快速建立匿名、便利的電子投票。
          </p>
          <div className="home-fade-up home-fade-up-delay-2 flex flex-wrap gap-3 pt-1">
            <Button asChild size="lg">
              <Link href="/vote">前往投票</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/admin">建立投票</Link>
            </Button>
          </div>
        </div>
      </section>

      <ValueProposition
        title="方便的建立投票"
        description="分步驟完成標題、選項與名單設定，活動、校園、社團與企業都能快速開出一場。"
        preview={<CreateVoteSystemPreview />}
      />

      <ValueProposition
        title="提供全螢幕檢視"
        description="以螢幕分享方式提供使用者進行投票，現場投影也能清楚引導參與。"
        preview={<ProjectionSystemPreview />}
      />

      <ValueProposition
        title="清晰的投票結果"
        description="開票後以圖表呈現得票，結果一目瞭然，方便當場公布與存檔。"
        preview={<ResultsSystemPreview />}
      />

      <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[linear-gradient(135deg,rgba(11,79,108,0.12),rgba(27,122,110,0.14))] px-6 py-12 text-center sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_240px_at_50%_0%,rgba(255,255,255,0.55),transparent_70%)]" />
        <div className="relative mx-auto max-w-xl space-y-5">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
            現在就建立一場投票
          </h2>
          <p className="text-[var(--muted-foreground)]">
            為活動、校園、社團或團隊，快速開出匿名、便利的電子投票。
          </p>
          <Button asChild size="lg">
            <Link href="/admin">建立投票</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
