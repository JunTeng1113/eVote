import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteBreadcrumb } from "@/components/site-breadcrumb";
import { SiteFooter } from "@/components/site-footer";
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
  description: "讓每個人快速建立匿名、便利的電子投票。",
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
            <SiteBreadcrumb />
            {children}
          </main>
          <SiteFooter />
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
