import { getServerSession as nextAuthGetServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { pbkdf2Sync, timingSafeEqual as nodeTSE } from "crypto";

// ─── Stored password hash helpers ────────────────────────────────────────────

const ADMIN_JSON = path.join(process.cwd(), "data", "admin.json");

async function getStoredPasswordHash(): Promise<string | null> {
  try {
    const raw = await fs.readFile(ADMIN_JSON, "utf-8");
    const data = JSON.parse(raw) as { passwordHash?: string | null };
    return data.passwordHash ?? null;
  } catch {
    return null;
  }
}

function verifyPbkdf2Hash(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const computed = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString(
    "hex"
  );
  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (computedBuf.length !== hashBuf.length) return false;
  return nodeTSE(computedBuf, hashBuf);
}

// ─── Augment NextAuth types to include role ────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "viewer";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "admin" | "viewer";
    id?: string;
  }
}

// ─── Auth Options ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
          console.error("[auth] ADMIN_EMAIL or ADMIN_PASSWORD not set in environment");
          return null;
        }

        // Email must always match the env var
        if (!timingSafeEqual(credentials.email, adminEmail)) return null;

        // Check stored PBKDF2 hash first; fall back to env var plaintext
        const storedHash = await getStoredPasswordHash();
        let passwordMatch = false;
        if (storedHash) {
          passwordMatch = verifyPbkdf2Hash(credentials.password, storedHash);
        } else {
          passwordMatch = timingSafeEqual(credentials.password, adminPassword);
        }

        if (passwordMatch) {
          return {
            id: "admin-1",
            name: "Koundinya Pidaparthy",
            email: credentials.email,
            role: "admin",
          };
        }
        return null;
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "admin" | "viewer" }).role ?? "viewer";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "admin" | "viewer") ?? "viewer";
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ─── Server-side session helper ───────────────────────────────────────────────

/**
 * Call inside Server Components, Route Handlers, or Server Actions.
 * Returns the current session or null.
 */
export function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

/**
 * Returns true if the current request has an admin session.
 * Throws if used outside a server context.
 */
export async function requireAdminSession() {
  const session = await getServerSession();
  if (!session || session.user.role !== "admin") {
    return null;
  }
  return session;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Naive constant-time string comparison (avoids early-exit timing leaks).
 * Not cryptographically perfect without native crypto.timingSafeEqual,
 * but prevents the most common timing attacks in plain JS.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing leak
    let acc = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      acc |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    void acc;
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
