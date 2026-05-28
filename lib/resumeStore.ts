/**
 * Server-side resume data store.
 * Reads and writes data/resume.json which acts as the application's
 * mutable "database" for resume content.
 *
 * IMPORTANT: This module uses Node.js `fs` APIs — only import it in
 * Server Components, Route Handlers, or Server Actions (never in client code).
 */

import { promises as fs } from "fs";
import path from "path";
import type { Resume } from "@/types/resume";

const RESUME_PATH = path.join(process.cwd(), "data", "resume.json");

/**
 * Read the full resume object from disk.
 * Throws if the file is missing or contains invalid JSON.
 */
export async function getResume(): Promise<Resume> {
  const raw = await fs.readFile(RESUME_PATH, "utf-8");
  return JSON.parse(raw) as Resume;
}

/**
 * Persist the full resume object to disk (pretty-printed JSON).
 * Replaces the existing file atomically via the OS rename guarantee
 * on most POSIX systems.
 */
export async function saveResume(data: Resume): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  // Write to a temp file first, then rename to prevent partial writes
  const tmpPath = `${RESUME_PATH}.tmp`;
  await fs.writeFile(tmpPath, json, "utf-8");
  await fs.rename(tmpPath, RESUME_PATH);
}
