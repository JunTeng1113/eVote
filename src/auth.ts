import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return adminEmails().includes(email.trim().toLowerCase());
}

const googleConfigured =
  typeof process.env.AUTH_GOOGLE_ID === "string" &&
  process.env.AUTH_GOOGLE_ID.length > 0 &&
  typeof process.env.AUTH_GOOGLE_SECRET === "string" &&
  process.env.AUTH_GOOGLE_SECRET.length > 0;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    session({ session }) {
      if (session.user?.email) {
        session.user.email = session.user.email.toLowerCase();
      }
      return session;
    },
  },
  trustHost: true,
});

export function isGoogleAuthConfigured(): boolean {
  return googleConfigured;
}
