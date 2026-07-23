import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 2 * 1024 * 1024;

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function asDataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function persistImage(
  bytes: Buffer,
  mime: string,
  filename: string,
): Promise<string> {
  // Vercel 等無狀態環境無法寫入 public/；直接存成 data URL 供 <img> 使用
  if (process.env.VERCEL === "1") {
    return asDataUrl(mime, bytes);
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  const dirReady = await mkdir(uploadDir, { recursive: true }).then(
    () => true,
    () => false,
  );
  if (!dirReady) {
    return asDataUrl(mime, bytes);
  }

  const filePath = path.join(uploadDir, filename);
  const written = await writeFile(filePath, bytes).then(
    () => true,
    () => false,
  );
  if (!written) {
    return asDataUrl(mime, bytes);
  }

  return `/uploads/${filename}`;
}

export async function POST(request: Request) {
  const user = await requireSessionUser();
  if (!user.ok) {
    return NextResponse.json(user, { status: 401 });
  }

  const form = await request.formData().then(
    (value) => value,
    () => null,
  );
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "無法讀取上傳內容，請再試一次" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "請選擇圖片檔" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, error: "僅支援 JPG、PNG、WebP、GIF" },
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "圖片需小於 2MB" },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}.${extensionFor(file.type)}`;
  const imageUrl = await persistImage(bytes, file.type, filename);

  return NextResponse.json({
    ok: true,
    imageUrl,
  });
}
