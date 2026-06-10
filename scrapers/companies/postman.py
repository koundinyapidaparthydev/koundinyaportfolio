#!/usr/bin/env python3
"""Scraper for Postman."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scrapers._base import run_company

COMPANY = 'Postman'

if __name__ == "__main__":
    raise SystemExit(run_company(COMPANY))
