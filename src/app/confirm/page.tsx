"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

const receiptSchema = z.object({
  receiptHash: z.string().min(16, "請貼上完整確認碼"),
});

export default function ConfirmPage() {
  const [lookup, setLookup] = useState<string | null>(null);
  const form = useForm<z.infer<typeof receiptSchema>>({
    resolver: zodResolver(receiptSchema),
    defaultValues: { receiptHash: "" },
  });

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("evote-receipt")
        : null;
    if (saved) {
      form.setValue("receiptHash", saved);
    }
  }, [form]);

  async function onLookup(values: z.infer<typeof receiptSchema>) {
    const res = await fetch(
      `/api/audit/verify?receipt=${encodeURIComponent(values.receiptHash)}`,
    );
    const data = (await res.json()) as {
      found: boolean;
      bulletinIndex?: number;
      submittedAt?: string;
      electionTitle?: string;
      votingMode?: "anonymous" | "named" | "named_open" | "open";
    };
    if (!data.found) {
      setLookup("找不到這組確認碼。請確認是否貼上完整內容。");
      return;
    }
    const privacyNote =
      data.votingMode === "named" || data.votingMode === "named_open"
        ? "確認碼只證明系統有收到你的票。"
        : "為保護隱私，不會顯示你投給誰。";
    setLookup(
      `已確認：系統有收到你的票${
        data.electionTitle ? `（${data.electionTitle}）` : ""
      }（編號 #${data.bulletinIndex}，時間 ${data.submittedAt}）。${privacyNote}`,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-[var(--primary)]">
          確認投票
        </h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          貼上投票完成後取得的確認碼，即可確認系統有收到你的票。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>查詢確認碼</CardTitle>
          <CardDescription>
            確認碼只證明「有投到」，不會洩漏你的選擇。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={form.handleSubmit(onLookup)}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="receiptHash">確認碼</Label>
              <Input id="receiptHash" {...form.register("receiptHash")} />
              {form.formState.errors.receiptHash ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.receiptHash.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="sm:mt-7">
              查詢
            </Button>
          </form>
          {lookup ? <Alert className="mt-4">{lookup}</Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}
