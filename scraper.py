#!/usr/bin/env python3
"""
Run the per-company scrape pipeline (Google Sheets + diffs + ATS).
Dispatches to scrapers/companies/<slug>.py when available.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def run_scraper(company: str) -> int:
    slug = slugify(company)
    script = ROOT / "scrapers" / "companies" / f"{slug}.py"

    if script.exists():
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT)
        result = subprocess.run(
            [sys.executable, str(script)],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
    else:
        env = os.environ.copy()
        env["COMPANY"] = company
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


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scraper.py <Company Name>", file=sys.stderr)
        return 1

    company = sys.argv[1]
    data = json.loads((ROOT / "companies.json").read_text(encoding="utf-8"))
    names = [c["name"] for c in data["companies"]]
    if company not in names:
        print(f"Unknown company: {company}", file=sys.stderr)
        return 1

    return run_scraper(company)


if __name__ == "__main__":
    raise SystemExit(main())
