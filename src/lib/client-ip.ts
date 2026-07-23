import { domainSeparatedHash } from "@/lib/crypto/hash";

/** 從請求標頭取得客戶端 IP（Vercel / 反向代理）。 */
export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && first.length > 0) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && realIp.length > 0) {
    return realIp;
  }
  // 本機開發常無代理標頭
  if (process.env.NODE_ENV === "development") {
    return "127.0.0.1";
  }
  return null;
}

/** 以選舉編號混雜後雜湊 IP，避免明文儲存。 */
export function hashVoterIp(electionId: string, ip: string): string {
  return domainSeparatedHash("guest-ip", electionId, ip);
}
