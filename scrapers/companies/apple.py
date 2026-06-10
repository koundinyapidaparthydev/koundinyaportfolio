#!/usr/bin/env python3
"""Scraper for Apple."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scrapers._base import run_company

COMPANY = 'Apple'

if __name__ == "__main__":
    raise SystemExit(run_company(COMPANY))
