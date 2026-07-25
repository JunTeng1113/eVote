"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseVoterEmailsFromFile } from "@/lib/voter-file-import";
import { toast } from "sonner";

type VoterEmailsFileImportProps = {
  onImported: (emails: string[]) => void;
  disabled?: boolean;
};

export function VoterEmailsFileImport({
  onImported,
  disabled = false,
}: VoterEmailsFileImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setImporting(true);
    const result = await parseVoterEmailsFromFile(file);
    setImporting(false);

    if (result.error || result.emails.length === 0) {
      toast.error(result.error ?? "檔案中找不到有效的 Email");
      return;
    }

    onImported(result.emails);
    toast.success(`已從檔案讀取 ${result.emails.length} 個 Email`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.csv,.xlsx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          void onFileChange(event);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || importing}
        onClick={() => inputRef.current?.click()}
      >
        {importing ? "匯入中…" : "從檔案匯入"}
      </Button>
      <span className="text-xs text-[var(--muted-foreground)]">
        支援 txt、csv、xlsx
      </span>
    </div>
  );
}
