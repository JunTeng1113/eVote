import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { AuthSessionProvider } from "@/components/auth-session-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const display = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "eVote｜線上投票",
  description: "使用 Google 帳號登入的匿名線上投票系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <AuthSessionProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-[var(--border)]/70 py-6 text-center text-xs text-[var(--muted-foreground)]">
            eVote · 線上投票
          </footer>
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
