/**
 * GET/POST /api/cron/jobs-pipeline
 *
 * Cloud scheduler hook — triggers the GitHub Actions jobs pipeline (does not run scrape locally).
 * Used by Vercel Cron or an external pinger (cron-job.org) when GHA native schedule is delayed.
 *
 * Auth: Authorization: Bearer <CRON_SECRET> (Vercel sets this automatically for Vercel Cron).
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const header = req.headers.get("x-cron-secret") ?? "";
  return header === secret;
}

async function triggerGithubWorkflow(mode = "full") {
  const token = process.env.GITHUB_PIPELINE_TOKEN?.trim();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repo) {
    return {
      ok: false as const,
      status: 503,
      body: { error: "GITHUB_PIPELINE_TOKEN and GITHUB_REPOSITORY must be set on Vercel" },
    };
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/jobs-pipeline.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_PIPELINE_REF?.trim() || "main",
        inputs: { mode },
      }),
    }
  );

  if (res.status === 204) {
    return {
      ok: true as const,
      status: 202,
      body: { triggered: true, repo, workflow: "jobs-pipeline.yml", mode },
    };
  }

  const detail = await res.text().catch(() => "");
  return {
    ok: false as const,
    status: res.status >= 400 ? res.status : 502,
    body: {
      error: "GitHub workflow dispatch failed",
      detail: detail.slice(0, 300),
    },
  };
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorized();
  const mode = req.nextUrl.searchParams.get("mode") ?? "full";
  const result = await triggerGithubWorkflow(mode);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) return unauthorized();
  let mode = "full";
  try {
    const body = await req.json();
    if (typeof body?.mode === "string") mode = body.mode;
  } catch {
    // empty body is fine
  }
  const result = await triggerGithubWorkflow(mode);
  return NextResponse.json(result.body, { status: result.status });
}
