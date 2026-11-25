import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function resolveSafe(rel: string) {
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid path");
  return full;
}

/** Validate an uploaded image. Returns an error message or null. */
export function checkImage(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) return "Choose an image to upload.";
  if (!IMAGE_TYPES[file.type]) return "Upload a JPEG, PNG or WebP image.";
  if (file.size > MAX_UPLOAD_BYTES) return "Images must be 10 MB or smaller.";
  return null;
}

/** Saves bytes under UPLOAD_DIR/<dir>/ and returns the relative path stored in the database. */
export async function saveFile(dir: string, bytes: Buffer | Uint8Array, mime: string) {
  const ext = IMAGE_TYPES[mime] ?? "bin";
  const rel = path.posix.join(dir, `${randomUUID()}.${ext}`);
  const full = resolveSafe(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return rel;
}

export const readStored = (rel: string) => readFile(resolveSafe(rel));
export const deleteStored = (rel: string) => unlink(resolveSafe(rel)).catch(() => undefined);
