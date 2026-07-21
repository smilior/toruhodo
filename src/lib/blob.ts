import { put } from "@vercel/blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";

/**
 * 写真を保存して公開 URL を返す。
 * - BLOB_READ_WRITE_TOKEN あり → Vercel Blob
 * - なし（ローカル）→ public/uploads にファイル保存（data URL は DB に入れない）
 */
export async function storePhoto(input: {
  imageBase64: string;
  mimeType?: string;
  userId: string;
}): Promise<string> {
  const mime = normalizeMime(input.mimeType || "image/jpeg");
  const raw = input.imageBase64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(raw, "base64");
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("webp")
      ? "webp"
      : "jpg";
  const id = nanoid();
  const safeUser = input.userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const pathname = `toruhodo/${safeUser}/${id}.${ext}`;
    const blob = await put(pathname, buf, {
      access: "public",
      contentType: mime,
      token,
    });
    return blob.url;
  }

  // ローカル: public/uploads に保存し静的配信
  const dir = path.join(process.cwd(), "public", "uploads", safeUser);
  await mkdir(dir, { recursive: true });
  const filename = `${id}.${ext}`;
  await writeFile(path.join(dir, filename), buf);
  return `/uploads/${safeUser}/${filename}`;
}

function normalizeMime(mime: string): string {
  if (mime === "image/jpg") return "image/jpeg";
  if (mime.startsWith("image/")) return mime;
  return "image/jpeg";
}
