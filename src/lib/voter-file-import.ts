import * as XLSX from "xlsx";

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const ALLOWED_EXTENSIONS = new Set(["txt", "csv", "xlsx"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) ?? [];
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of matches) {
    const email = raw.trim().toLowerCase();
    if (seen.has(email)) {
      continue;
    }
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function mergeEmailsIntoDraft(
  current: string,
  incoming: string[],
): string {
  return extractEmailsFromText(`${current}\n${incoming.join("\n")}`).join("\n");
}

function fileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  if (parts.length < 2) {
    return "";
  }
  return parts[parts.length - 1] ?? "";
}

async function readWorkbookAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const chunks: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }
    chunks.push(XLSX.utils.sheet_to_csv(sheet));
  }
  return chunks.join("\n");
}

export async function parseVoterEmailsFromFile(
  file: File,
): Promise<{ emails: string[]; error?: string }> {
  if (file.size <= 0) {
    return { emails: [], error: "檔案是空的" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { emails: [], error: "檔案過大，請小於 5MB" };
  }

  const extension = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { emails: [], error: "僅支援 txt、csv、xlsx 檔案" };
  }

  const text =
    extension === "xlsx" ? await readWorkbookAsText(file) : await file.text();
  if (!text.trim()) {
    return { emails: [], error: "檔案是空的" };
  }

  const emails = extractEmailsFromText(text);
  if (emails.length === 0) {
    return { emails: [], error: "檔案中找不到有效的 Email" };
  }
  return { emails };
}
