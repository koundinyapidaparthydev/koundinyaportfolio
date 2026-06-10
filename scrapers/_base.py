"""Shared per-company scraper runner — delegates to Node pipeline (Sheets-only)."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_company(company: str) -> int:
    env = os.environ.copy()
    env["COMPANY"] = company
    env.pop("DRY_RUN", None)
    env.pop("SCRAPE_ONLY", None)

    result = subprocess.run(
        ["node", "scripts/run-company-pipeline.mjs"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.returncode
