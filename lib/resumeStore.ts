/**
 * Server-side resume data store.
 *
 * - Local dev: reads/writes data/resume.json on disk.
 * - Production (Vercel): persists to GCS (config/resume.json) because the
 *   server filesystem is read-only.
 *
 * IMPORTANT: Node.js `fs` — only import in Server Components, Route Handlers,
 * or Server Actions (never in client code).
 */

import { promises as fs } from "fs";
import path from "path";
import type { Resume } from "@/types/resume";
import {
  downloadFromGCS,
  uploadToGCS,
  RESUME_GCS_KEY,
} from "@/lib/gcsUpload";

const RESUME_PATH = path.join(process.cwd(), "data", "resume.json");

function gcsConfigured(): boolean {
  return !!(
    process.env.GCS_SERVICE_ACCOUNT_JSON?.trim() &&
    process.env.GCS_BUCKET_NAME?.trim()
  );
}

async function readResumeFromDisk(): Promise<Resume> {
  const raw = await fs.readFile(RESUME_PATH, "utf-8");
  return JSON.parse(raw) as Resume;
}

async function writeResumeToDisk(data: Resume): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${RESUME_PATH}.tmp`;
  await fs.writeFile(tmpPath, json, "utf-8");
  await fs.rename(tmpPath, RESUME_PATH);
}

/**
 * Read the full resume object.
 * Prefers GCS when configured; falls back to bundled data/resume.json.
 */
export async function getResume(): Promise<Resume> {
  if (gcsConfigured()) {
    try {
      const raw = await downloadFromGCS(RESUME_GCS_KEY);
      return JSON.parse(raw.toString("utf-8")) as Resume;
    } catch (err) {
      console.warn(
        "[resumeStore] GCS read failed, using bundled resume.json:",
        (err as Error).message
      );
    }
  }

  return readResumeFromDisk();
}

/**
 * Persist the full resume object.
 * Writes to GCS in production; also updates local file when writable.
 */
export async function saveResume(data: Resume): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  if (gcsConfigured()) {
    try {
      await uploadToGCS(
        Buffer.from(json, "utf-8"),
        RESUME_GCS_KEY,
        "application/json"
      );
    } catch (err) {
      console.error("[resumeStore] GCS save failed:", err);
      throw new Error("Failed to save resume to cloud storage.");
    }

    try {
      await writeResumeToDisk(data);
    } catch {
      // Vercel read-only fs — GCS save already succeeded.
    }
    return;
  }

  try {
    await writeResumeToDisk(data);
  } catch (err) {
    console.warn("[resumeStore] local write failed:", (err as Error).message);
    throw new Error(
      "Resume cannot be saved: configure GCS credentials for production or use a writable local filesystem."
    );
  }
}
