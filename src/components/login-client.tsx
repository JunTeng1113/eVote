"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export function LoginClient({ googleEnabled }: { googleEnabled: boolean }) {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>登入 eVote</CardTitle>
        <CardDescription>
          請使用 Google 帳號登入。只有主辦單位允許的帳號可以投票。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert className="border-red-300/50 bg-red-50 text-red-900">
            登入失敗，請稍後再試。
          </Alert>
        ) : null}
        <Button
          className="w-full"
          size="lg"
          disabled={!googleEnabled}
          onClick={() => void signIn("google", { callbackUrl: "/vote" })}
        >
          使用 Google 登入
        </Button>
      </CardContent>
    </Card>
  );
}
