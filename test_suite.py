#!/usr/bin/env python3
"""Run Jest pipeline tests for the job scraper."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

PIPELINE_TESTS = [
    "__tests__/pipeline/scrapeJobs.test.ts",
    "__tests__/pipeline/generalCompanies.test.ts",
    "__tests__/pipeline/aiAgenticsCompanies.test.ts",
    "__tests__/pipeline/concurrency.test.ts",
    "__tests__/pipeline/envParser.test.ts",
    "__tests__/pipeline/atsScoring.mjs.test.ts",
]


def main() -> int:
    cmd = ["npm", "test", "--", *PIPELINE_TESTS, "--passWithNoTests"]
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)

    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)

    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
