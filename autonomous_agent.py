#!/usr/bin/env python3
"""
Autonomous scraper loop:
  1. Run scraper.py for each company in companies.json (up to 3 retries)
  2. Run test_suite.py
  3. Log results to run_log.txt
  4. Repeat every 10 minutes until stopped
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_FILE = ROOT / "run_log.txt"
COMPANIES_FILE = ROOT / "companies.json"
MAX_RETRIES = 3
LOOP_INTERVAL_SEC = 600  # 10 minutes


def ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def log(msg: str) -> None:
    line = f"[{ts()}] {msg}\n"
    print(line, end="")
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(line)


def load_companies() -> list[str]:
    data = json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))
    return [c["name"] for c in data["companies"]]


def run_scraper(company: str) -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "scraper.py", company],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    output = (result.stdout or "") + (result.stderr or "")
    return result.returncode == 0, output.strip()


def run_tests() -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, "test_suite.py"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    output = (result.stdout or "") + (result.stderr or "")
    return result.returncode == 0, output.strip()


def scrape_all_companies() -> dict[str, str]:
    """Returns {company: status} where status is OK, FAILED, or SKIPPED."""
    companies = load_companies()
    results: dict[str, str] = {}

    log(f"=== Starting scrape cycle for {len(companies)} companies ===")

    for company in companies:
        success = False
        last_error = ""

        for attempt in range(1, MAX_RETRIES + 1):
            log(f"SCRAPER {company} attempt {attempt}/{MAX_RETRIES}")
            ok, output = run_scraper(company)
            if ok:
                log(f"SCRAPER {company} OK")
                results[company] = "OK"
                success = True
                break
            last_error = output[-500:] if output else "non-zero exit"
            log(f"SCRAPER {company} ERROR attempt {attempt}: {last_error}")

        if not success:
            log(f"SCRAPER {company} FAILED (skipped after {MAX_RETRIES} attempts)")
            results[company] = "FAILED"

    ok_count = sum(1 for s in results.values() if s == "OK")
    fail_count = sum(1 for s in results.values() if s == "FAILED")
    log(f"Scrape cycle done: {ok_count} OK, {fail_count} FAILED")
    log("Diffs + ATS scores written to Google Sheets (Scrape Log, Significant Changes tabs)")
    return results


def run_cycle() -> None:
    scrape_all_companies()

    log("Running test_suite.py")
    tests_ok, test_output = run_tests()
    if tests_ok:
        log("TEST_SUITE PASSED")
    else:
        log(f"TEST_SUITE FAILED: {test_output[-1000:]}")
        # Re-run tests once after a brief pause (agent may fix code between cycles)
        time.sleep(2)
        tests_ok2, test_output2 = run_tests()
        if tests_ok2:
            log("TEST_SUITE PASSED on re-run")
        else:
            log(f"TEST_SUITE still failing: {test_output2[-1000:]}")

    log("=== Cycle complete ===")


def main() -> None:
    once = "--once" in sys.argv
    log("Autonomous agent started" + (" (single cycle)" if once else " (10-minute loop). Send STOP to halt."))
    while True:
        try:
            run_cycle()
        except Exception as exc:
            log(f"CYCLE ERROR: {exc}")
        if once:
            break
        log(f"Sleeping {LOOP_INTERVAL_SEC}s until next cycle...")
        time.sleep(LOOP_INTERVAL_SEC)


if __name__ == "__main__":
    main()
