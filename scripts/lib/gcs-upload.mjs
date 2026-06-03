/**
 * Shared GCS upload helper for pipeline scripts (resumes, apply recordings).
 */
import { readFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { dirname } from "path";
import { Storage } from "@google-cloud/storage";

const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID ?? "jobseek-459701";
const SIGNED_URL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let _storage = null;

function getStorage() {
  if (_storage) return _storage;

  const saJson = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (!saJson?.trim()) {
    throw new Error("GCS_SERVICE_ACCOUNT_JSON is not set");
  }
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName?.trim()) {
    throw new Error("GCS_BUCKET_NAME is not set");
  }

  _storage = new Storage({
    credentials: JSON.parse(saJson),
    projectId: GCS_PROJECT_ID,
  });
  return _storage;
}

export function slugifyCompany(name) {
  return (
    (name || "unknown")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "unknown"
  );
}

export function buildApplyRecordingPrefix(rowIndex, company, date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const slug = slugifyCompany(company);
  return `apply-recordings/${dateStr}/row-${rowIndex}-${slug}`;
}

export async function uploadBufferToGCS(buffer, gcsPath, contentType = "application/octet-stream") {
  const bucketName = process.env.GCS_BUCKET_NAME;
  const file = getStorage().bucket(bucketName).file(gcsPath);
  await file.save(buffer, { metadata: { contentType }, resumable: false });
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + SIGNED_URL_TTL_MS,
  });
  return signedUrl;
}

export async function uploadLocalFileToGCS(localPath, gcsPath, contentType) {
  const buffer = readFileSync(localPath);
  return uploadBufferToGCS(buffer, gcsPath, contentType);
}

function copyToArtifactsFallback(localPath, gcsPath) {
  const dest = `${process.cwd()}/artifacts/${gcsPath}`;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(localPath, dest);
  return dest;
}

/**
 * Upload apply recording files to GCS. On failure, copy to ./artifacts/ for CI fallback.
 * @returns {{ urls: Record<string, string>, fallbackPaths: Record<string, string> }}
 */
export async function uploadApplyRecordingFiles(rowIndex, company, files) {
  const prefix = buildApplyRecordingPrefix(rowIndex, company);
  const urls = {};
  const fallbackPaths = {};

  for (const { key, localPath, remoteName, contentType } of files) {
    if (!localPath || !existsSync(localPath)) continue;
    const gcsPath = `${prefix}/${remoteName}`;

    try {
      const url = await uploadLocalFileToGCS(localPath, gcsPath, contentType);
      urls[key] = url;
      console.log(`  📹 GCS ${key} (row ${rowIndex}): ${url}`);
      console.log(`::notice title=Apply recording row ${rowIndex} ${key}::${url}`);
    } catch (err) {
      console.warn(`  ⚠  GCS upload failed (${key}, row ${rowIndex}): ${err.message}`);
      try {
        const localDest = copyToArtifactsFallback(localPath, gcsPath);
        fallbackPaths[key] = localDest;
        console.warn(`  ↳ Fallback artifact: ${localDest}`);
      } catch (copyErr) {
        console.warn(`  ↳ Fallback copy failed: ${copyErr.message}`);
      }
    }
  }

  return { urls, fallbackPaths };
}

export function formatRecordingNotes(baseNotes, urls) {
  const parts = [baseNotes].filter(Boolean);
  for (const [key, url] of Object.entries(urls)) {
    if (url) parts.push(`${key}: ${url}`);
  }
  return parts.join(" | ");
}
