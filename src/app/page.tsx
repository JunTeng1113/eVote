import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeResultPreviews } from "@/components/home-result-previews";

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="home-fade-up relative grid items-center gap-10 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(11,79,108,0.1),transparent_42%,rgba(27,122,110,0.12))]" />
        <div className="pointer-events-none absolute -right-16 top-8 h-56 w-56 rounded-full bg-[rgba(27,122,110,0.12)] blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-[rgba(11,79,108,0.1)] blur-3xl" />

        <div className="relative space-y-6">
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-[var(--primary)] sm:text-6xl lg:text-7xl">
            eVote
          </h1>
          <p className="home-fade-up home-fade-up-delay-1 max-w-xl text-lg leading-relaxed text-[var(--foreground)] sm:text-xl">
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

        <div
          className="home-fade-up home-fade-up-delay-2 home-float relative mx-auto w-full max-w-md lg:mx-0"
          aria-hidden
        >
          <div className="absolute -inset-3 rounded-[1.75rem] bg-[linear-gradient(160deg,rgba(11,79,108,0.16),rgba(27,122,110,0.1))]" />
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[rgba(255,255,255,0.92)] p-5 shadow-[0_20px_48px_rgba(15,28,36,0.1)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--primary)]">
                社員大會 · 表決中
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">全螢幕檢視</span>
            </div>
            <div className="mt-4 space-y-2.5">
              {["同意", "不同意", "棄權"].map((label, index) => (
                <div
                  key={label}
                  className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm"
                  style={{ opacity: 1 - index * 0.08 }}
                >
                  <div className="font-medium">{label}</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--secondary)]"
                      style={{ width: `${[72, 41, 22][index]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-[var(--muted-foreground)]">
              適合以螢幕分享給現場參與者
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-12 md:grid-cols-2 md:gap-10">
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)] sm:text-3xl">
            方便的建立投票
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
            分步驟完成標題、選項與名單設定，活動、校園、社團與企業都能快速開出一場。
          </p>
        </div>
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)] sm:text-3xl">
            提供全螢幕檢視
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
            以螢幕分享方式提供使用者進行投票，現場投影也能清楚引導參與。
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--primary)] sm:text-3xl">
            清晰的投票結果
          </h2>
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
            開票後以圖表呈現得票，結果一目瞭然，方便當場公布與存檔。
          </p>
        </div>
        <HomeResultPreviews />
      </section>

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
