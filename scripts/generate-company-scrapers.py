#!/usr/bin/env python3
"""Generate one Python scraper file per company in companies.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_FILE = ROOT / "companies.json"
SCRAPERS_DIR = ROOT / "scrapers" / "companies"


def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


TEMPLATE = '''#!/usr/bin/env python3
"""Scraper for {company_name}."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scrapers._base import run_company

COMPANY = {company_repr!r}

if __name__ == "__main__":
    raise SystemExit(run_company(COMPANY))
'''


def main() -> None:
    data = json.loads(COMPANIES_FILE.read_text(encoding="utf-8"))
    SCRAPERS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRAPERS_DIR / "__init__.py").write_text("", encoding="utf-8")

    count = 0
    for entry in data["companies"]:
        name = entry["name"]
        slug = slugify(name)
        path = SCRAPERS_DIR / f"{slug}.py"
        path.write_text(TEMPLATE.format(company_name=name, company_repr=name), encoding="utf-8")
        count += 1

    print(f"Generated {count} company scrapers in {SCRAPERS_DIR}")


if __name__ == "__main__":
    main()
