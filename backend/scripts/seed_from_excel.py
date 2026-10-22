"""Seed Walmus ERP from the original Sale Sheet workbook.

Usage (from the repository root):

    backend\\.venv\\Scripts\\python.exe backend\\scripts\\seed_from_excel.py

    # Preview only, no database writes
    ... seed_from_excel.py --dry-run

    # Custom workbook path
    ... seed_from_excel.py --file "D:\\path\\Sale Sheet MA-Na.xlsx"

The import is idempotent: re-running it updates imported historical rows and
skips master data that already exists.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select

from app.core.database import async_session_maker
from app.core.security import get_password_hash
from app.models import AppUser
from app.services.excel_import_export import commit_workbook, preview_workbook


DEFAULT_WORKBOOK = BACKEND_DIR.parent / "Sale Sheet MA-Na.xlsx"


async def ensure_owner(db) -> AppUser:
    user = (await db.execute(select(AppUser).order_by(AppUser.created_at))).scalars().first()
    if user:
        return user
    user = AppUser(
        username="owner",
        password_hash=get_password_hash("owner"),
        full_name="Business Owner",
        email="owner@walmus.local",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def run(path: Path, dry_run: bool) -> None:
    if not path.exists():
        raise SystemExit(f"Workbook not found: {path}")

    content = path.read_bytes()
    preview = preview_workbook(content, path.name)
    print("Workbook preview")
    print(json.dumps(preview["totals"], indent=2, default=str))
    print("\nMonthly totals")
    for row in preview["rows"]:
        print(
            f"  {row['period']}  products={row['products']:>3}  "
            f"sales={row['total_sales']:>12,.2f}  profit={row['total_profit']:>12,.2f}"
        )

    if dry_run:
        print("\nDry run: no records were written.")
        return

    async with async_session_maker() as db:
        owner = await ensure_owner(db)
        result = await commit_workbook(db, content, path.name, owner.id)

    print("\nImport committed")
    print(json.dumps({
        "batch_id": str(result["batch_id"]),
        "rows_total": result["rows_total"],
        "rows_imported": result["rows_imported"],
        "rows_skipped": result["rows_skipped"],
        "summary": result["summary"],
    }, indent=2, default=str))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed ERP data from Sale Sheet MA-Na.xlsx")
    parser.add_argument("--file", type=Path, default=DEFAULT_WORKBOOK, help="Path to the workbook")
    parser.add_argument("--dry-run", action="store_true", help="Parse and preview without writing")
    args = parser.parse_args()
    asyncio.run(run(args.file, args.dry_run))


if __name__ == "__main__":
    main()
