/**
 * PATCH /api/auth/password
 *
 * Admin-only endpoint to change the admin password.
 * Uses PBKDF2-SHA512 with a random salt for secure storage.
 * The new hash is persisted to data/admin.json and is checked
 * by lib/auth.ts on subsequent logins.
 */

import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { pbkdf2Sync, randomBytes, timingSafeEqual as nodeTSE } from "crypto";
import { z } from "zod";
import { requireAdminSession } from "@/lib/auth";
import { normalizeEnvValue } from "@/lib/env";

const ADMIN_PATH = path.join(process.cwd(), "data", "admin.json");

interface AdminData {
  passwordHash: string | null;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

// ─── Crypto helpers ───────────────────────────────────────────────────────────

function derivePbkdf2(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
}

function makeHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${derivePbkdf2(password, salt)}`;
}

function checkHash(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const computed = derivePbkdf2(password, salt);
  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (computedBuf.length !== hashBuf.length) return false;
  return nodeTSE(computedBuf, hashBuf);
}

// ─── Read / write admin.json ─────────────────────────────────────────────────

async function readAdminData(): Promise<AdminData> {
  try {
    const raw = await fs.readFile(ADMIN_PATH, "utf-8");
    return JSON.parse(raw) as AdminData;
  } catch {
    return { passwordHash: null };
  }
}

async function writeAdminData(data: AdminData): Promise<void> {
  const tmp = `${ADMIN_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, ADMIN_PATH);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  // ── Verify current password ────────────────────────────────────────────────
  const adminData = await readAdminData();
  let currentValid = false;

  if (adminData.passwordHash) {
    // Verify against stored PBKDF2 hash
    currentValid = checkHash(currentPassword, adminData.passwordHash);
  } else {
    // Fall back to env var (initial deployment, no stored hash yet)
    const envPassword = normalizeEnvValue(process.env.ADMIN_PASSWORD ?? "");
    const a = Buffer.from(currentPassword);
    const b = Buffer.from(envPassword);
    currentValid =
      a.length === b.length &&
      nodeTSE(a, b);
  }

  if (!currentValid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 400 }
    );
  }

  // ── Persist new hash ───────────────────────────────────────────────────────
  const newHash = makeHash(newPassword);
  await writeAdminData({ passwordHash: newHash });

  return NextResponse.json({ success: true });
}
