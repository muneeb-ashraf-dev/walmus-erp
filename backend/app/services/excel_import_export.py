"""Excel/CSV import, export and workbook seeding services."""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional, Tuple
from uuid import UUID

from openpyxl import Workbook, load_workbook
from openpyxl.utils import get_column_letter
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.models import (
    Customer,
    DoctorInvestment,
    Expense,
    ExpenseCategory,
    FinancialAccount,
    ImportBatch,
    ImportedCustomerPerformance,
    ImportedMonthSummary,
    ImportedSalesHistory,
    InvestmentTransaction,
    Medicine,
    MedicineBatch,
    MedicineUnit,
    OwnerSettings,
    PurchaseInvoice,
    SalesInvoice,
    Supplier,
)

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}
MONTH_RE = re.compile(r"Month\s*:\s*([A-Za-z]+)\s+(\d{4})", re.IGNORECASE)
YEAR_RE = re.compile(r"Year\s*:\s*(\d{4})", re.IGNORECASE)

SUPPORTED_IMPORT_ENTITIES = ("medicines", "customers", "suppliers", "sales-history")
SUPPORTED_EXPORT_ENTITIES = (
    "medicines", "customers", "suppliers", "inventory", "sales", "purchases",
    "expenses", "investments", "sales-history", "month-summary",
)

TEMPLATES: Dict[str, List[str]] = {
    "medicines": [
        "Product Code", "Name", "Generic Name", "Strength", "Dosage Form",
        "Packing", "Purchase Rate", "Sale Rate", "Reorder Level", "Is Active",
    ],
    "customers": [
        "Name", "Type", "Specialty", "Area", "Phone", "Address",
        "Opening Balance", "Is Active",
    ],
    "suppliers": [
        "Name", "Contact Person", "Phone", "Email", "Address",
        "Opening Balance", "Payment Terms Days", "Is Active",
    ],
    "sales-history": [
        "Year", "Month", "Product Name", "Product Code", "Quantity Sold",
        "Sale Amount", "Purchase Quantity", "Purchase Amount",
        "Profit Amount", "Balance Quantity",
    ],
}


# ---------------------------------------------------------------------------
# Primitive helpers
# ---------------------------------------------------------------------------

def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _num(value: Any, default: Optional[float] = 0.0) -> Optional[float]:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    cleaned = str(value).replace(",", "").replace("Rs.", "").replace("Rs", "").strip()
    cleaned = cleaned.replace("%", "")
    if cleaned in ("", "-", ".", "N/A", "n/a"):
        return default
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return default


def _bool(value: Any, default: bool = True) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ("1", "true", "yes", "y", "active")


def _norm_header(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", _text(value).lower())


def _month_from_name(name: str) -> Optional[int]:
    return MONTHS.get(name.strip().lower())


def slug_product_code(name: str) -> str:
    code = re.sub(r"[^A-Z0-9]+", "", name.upper())
    code = code[:34] or "PRODUCT"
    return f"IMP-{code}"


def _unit_code_for(name: str) -> str:
    lower = name.lower()
    if "inj" in lower:
        return "INJ"
    if "sachet" in lower:
        return "SACHET"
    if "drop" in lower:
        return "DROP"
    if "syp" in lower or "syrup" in lower or "susp" in lower:
        return "BOT"
    if "softgel" in lower or "cap" in lower:
        return "CAP"
    return "TAB"


def _row_dict(headers: List[str], values: Iterable[Any]) -> Dict[str, Any]:
    return {headers[i]: v for i, v in enumerate(values) if i < len(headers)}


# ---------------------------------------------------------------------------
# File readers
# ---------------------------------------------------------------------------

def read_tabular(content: bytes, filename: str) -> Tuple[List[str], List[Tuple[int, Dict[str, Any]]], Optional[str]]:
    """Read CSV/XLSX into a header list and (row_number, values) tuples."""
    lower = filename.lower()
    if lower.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        reader = list(csv.reader(io.StringIO(text)))
        if not reader:
            raise ValidationError("The uploaded CSV file is empty")
        headers = [_text(h) for h in reader[0]]
        rows = []
        for index, values in enumerate(reader[1:], start=2):
            if not any(_text(v) for v in values):
                continue
            rows.append((index, _row_dict(headers, values)))
        return headers, rows, None

    if not lower.endswith((".xlsx", ".xlsm")):
        raise ValidationError("Unsupported file type. Upload an .xlsx, .xlsm or .csv file")

    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    ws = wb.active
    sheet_name = ws.title
    raw_rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not raw_rows:
        raise ValidationError("The uploaded workbook is empty")

    header_index = 0
    for i, values in enumerate(raw_rows):
        if any(_text(v) for v in values):
            header_index = i
            break
    headers = [_text(v) for v in raw_rows[header_index]]
    while headers and not headers[-1]:
        headers.pop()
    rows: List[Tuple[int, Dict[str, Any]]] = []
    for index, values in enumerate(raw_rows[header_index + 1:], start=header_index + 2):
        if not any(_text(v) for v in values):
            continue
        rows.append((index, _row_dict(headers, values)))
    return headers, rows, sheet_name


def _find_key(row: Dict[str, Any], *names: str) -> Any:
    normalized = {_norm_header(k): v for k, v in row.items()}
    for name in names:
        key = _norm_header(name)
        if key in normalized:
            return normalized[key]
    return None


# ---------------------------------------------------------------------------
# Entity validation
# ---------------------------------------------------------------------------

def _validate_row(entity: str, row: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    errors: List[str] = []
    if entity == "medicines":
        name = _text(_find_key(row, "Name", "Medicine Name", "Product Name"))
        if not name:
            errors.append("Name is required")
        parsed = {
            "name": name,
            "product_code": _text(_find_key(row, "Product Code", "Code")) or slug_product_code(name or "PRODUCT"),
            "generic_name": _text(_find_key(row, "Generic Name", "Generic")),
            "strength": _text(_find_key(row, "Strength")),
            "dosage_form": _text(_find_key(row, "Dosage Form", "Form")),
            "packing_description": _text(_find_key(row, "Packing", "Packing Description")),
            "default_purchase_rate": _num(_find_key(row, "Purchase Rate", "Purchase Price")) or 0,
            "default_sale_rate": _num(_find_key(row, "Sale Rate", "Sale Price", "Retail Rate")) or 0,
            "reorder_level": int(_num(_find_key(row, "Reorder Level", "Reorder"), 0) or 0),
            "is_active": _bool(_find_key(row, "Is Active", "Active")),
        }
    elif entity == "customers":
        name = _text(_find_key(row, "Name", "Customer Name"))
        if not name:
            errors.append("Name is required")
        parsed = {
            "name": name,
            "customer_type": _text(_find_key(row, "Type", "Customer Type")) or "doctor",
            "specialty": _text(_find_key(row, "Specialty", "Speciality")) or None,
            "area": _text(_find_key(row, "Area", "City")) or None,
            "phone": _text(_find_key(row, "Phone", "Mobile")) or None,
            "address": _text(_find_key(row, "Address")) or None,
            "opening_balance": _num(_find_key(row, "Opening Balance"), 0) or 0,
            "is_active": _bool(_find_key(row, "Is Active", "Active")),
        }
    elif entity == "suppliers":
        name = _text(_find_key(row, "Name", "Supplier Name"))
        if not name:
            errors.append("Name is required")
        parsed = {
            "name": name,
            "contact_person": _text(_find_key(row, "Contact Person", "Contact")) or None,
            "phone": _text(_find_key(row, "Phone", "Mobile")) or None,
            "email": _text(_find_key(row, "Email")) or None,
            "address": _text(_find_key(row, "Address")) or None,
            "opening_balance": _num(_find_key(row, "Opening Balance"), 0) or 0,
            "payment_terms_days": int(_num(_find_key(row, "Payment Terms Days", "Payment Terms"), 30) or 30),
            "is_active": _bool(_find_key(row, "Is Active", "Active")),
        }
    else:  # sales-history
        year = int(_num(_find_key(row, "Year"), 0) or 0)
        month_raw = _find_key(row, "Month")
        month = int(_num(month_raw, 0) or 0)
        if not month and isinstance(month_raw, str):
            month = _month_from_name(month_raw) or 0
        product = _text(_find_key(row, "Product Name", "Product", "Medicine"))
        if not (2000 <= year <= 2100):
            errors.append("Year must be between 2000 and 2100")
        if not (1 <= month <= 12):
            errors.append("Month must be between 1 and 12")
        if not product:
            errors.append("Product Name is required")
        parsed = {
            "period_year": year,
            "period_month": month,
            "product_name": product,
            "product_code": _text(_find_key(row, "Product Code", "Code")),
            "quantity_sold": _num(_find_key(row, "Quantity Sold", "Qty Sold", "Sale Qty"), 0) or 0,
            "sale_amount": _num(_find_key(row, "Sale Amount", "Sales", "Total Sale"), 0) or 0,
            "purchase_quantity": _num(_find_key(row, "Purchase Quantity", "Purchase Qty"), 0) or 0,
            "purchase_amount": _num(_find_key(row, "Purchase Amount", "Purchase"), 0) or 0,
            "profit_amount": _num(_find_key(row, "Profit Amount", "Profit"), 0) or 0,
            "balance_quantity": _num(_find_key(row, "Balance Quantity", "Balance"), 0) or 0,
        }
    return (parsed if not errors else None), errors


def preview_entity(
    entity: str,
    content: bytes,
    filename: str,
    max_rows: int = 100,
) -> Dict[str, Any]:
    if entity not in SUPPORTED_IMPORT_ENTITIES:
        raise ValidationError(f"Unsupported import entity: {entity}")
    headers, raw_rows, sheet_name = read_tabular(content, filename)
    errors: List[Dict[str, Any]] = []
    parsed_rows: List[Dict[str, Any]] = []
    invalid = 0
    for row_number, row in raw_rows:
        parsed, row_errors = _validate_row(entity, row)
        if row_errors:
            invalid += 1
            for message in row_errors:
                errors.append({"row": row_number, "field": None, "message": message})
            continue
        assert parsed is not None
        parsed["_row"] = row_number
        parsed_rows.append(parsed)

    # Duplicate detection within the uploaded file
    key_field = "product_code" if entity == "medicines" else "name"
    seen: Dict[str, int] = {}
    for parsed in parsed_rows:
        key = _text(parsed.get(key_field)).lower()
        if not key:
            continue
        if key in seen:
            errors.append({
                "row": parsed.get("_row"),
                "field": key_field,
                "message": f"Duplicate {key_field.replace('_', ' ')} '{parsed.get(key_field)}' (first at row {seen[key]})",
            })
        else:
            seen[key] = int(parsed.get("_row") or 0)

    return {
        "entity": entity,
        "file_name": filename,
        "sheet_name": sheet_name,
        "headers": headers,
        "total_rows": len(raw_rows),
        "valid_rows": len(parsed_rows),
        "invalid_rows": invalid,
        "rows": parsed_rows[:max_rows],
        "errors": errors[:500],
        "warnings": [] if parsed_rows else ["No valid data rows were found"],
    }


# ---------------------------------------------------------------------------
# Entity commit
# ---------------------------------------------------------------------------

async def _get_or_create_batch(
    db: AsyncSession, entity: str, filename: str, sheet: Optional[str], user_id: Optional[UUID]
) -> ImportBatch:
    batch = ImportBatch(
        source_file=filename,
        source_sheet=sheet,
        import_type=entity,
        status="processing",
        created_by=user_id,
    )
    db.add(batch)
    await db.flush()
    return batch


async def commit_entity(
    db: AsyncSession,
    entity: str,
    content: bytes,
    filename: str,
    user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    preview = preview_entity(entity, content, filename)
    headers, raw_rows, sheet_name = read_tabular(content, filename)

    batch = await _get_or_create_batch(db, entity, filename, sheet_name, user_id)
    imported = 0
    skipped = 0
    failed = 0
    errors: List[Dict[str, Any]] = list(preview["errors"])

    units = {
        u.code: u for u in (await db.execute(select(MedicineUnit))).scalars().all()
    }

    for row_number, row in raw_rows:
        parsed, row_errors = _validate_row(entity, row)
        if row_errors:
            failed += 1
            continue
        assert parsed is not None
        try:
            if entity == "medicines":
                product_code = parsed["product_code"]
                existing = (
                    await db.execute(
                        select(Medicine).where(
                            (Medicine.product_code == product_code)
                            | (func.lower(Medicine.name) == parsed["name"].lower())
                        )
                    )
                ).scalars().first()
                unit_code = _unit_code_for(parsed["name"])
                unit = units.get(unit_code) or units.get("TAB")
                if not unit:
                    raise ValidationError("No medicine units are configured")
                if existing:
                    existing.name = parsed["name"]
                    existing.generic_name = parsed["generic_name"] or existing.generic_name
                    existing.strength = parsed["strength"] or existing.strength
                    existing.dosage_form = parsed["dosage_form"] or existing.dosage_form
                    existing.packing_description = parsed["packing_description"] or existing.packing_description
                    existing.default_purchase_rate = parsed["default_purchase_rate"]
                    existing.default_sale_rate = parsed["default_sale_rate"]
                    existing.reorder_level = parsed["reorder_level"]
                    existing.is_active = parsed["is_active"]
                    skipped += 1
                else:
                    db.add(Medicine(
                        product_code=product_code,
                        name=parsed["name"],
                        generic_name=parsed["generic_name"] or None,
                        strength=parsed["strength"] or None,
                        dosage_form=parsed["dosage_form"] or None,
                        packing_description=parsed["packing_description"] or None,
                        base_unit_id=unit.id,
                        units_per_pack=1,
                        purchase_unit_id=unit.id,
                        purchase_conversion_factor=1,
                        sale_unit_id=unit.id,
                        sale_conversion_factor=1,
                        default_purchase_rate=parsed["default_purchase_rate"],
                        default_sale_rate=parsed["default_sale_rate"],
                        reorder_level=parsed["reorder_level"],
                        is_active=parsed["is_active"],
                        created_by=user_id,
                    ))
                    imported += 1
            elif entity == "customers":
                existing = (
                    await db.execute(
                        select(Customer).where(func.lower(Customer.name) == parsed["name"].lower())
                    )
                ).scalars().first()
                if existing:
                    for field in ("customer_type", "specialty", "area", "phone", "address", "is_active"):
                        setattr(existing, field, parsed[field])
                    skipped += 1
                else:
                    db.add(Customer(**parsed, created_by=user_id))
                    imported += 1
            elif entity == "suppliers":
                existing = (
                    await db.execute(
                        select(Supplier).where(func.lower(Supplier.name) == parsed["name"].lower())
                    )
                ).scalars().first()
                if existing:
                    for field in ("contact_person", "phone", "email", "address", "is_active"):
                        setattr(existing, field, parsed[field])
                    skipped += 1
                else:
                    db.add(Supplier(**parsed, created_by=user_id))
                    imported += 1
            else:  # sales-history
                existing = (
                    await db.execute(
                        select(ImportedSalesHistory).where(
                            ImportedSalesHistory.period_year == parsed["period_year"],
                            ImportedSalesHistory.period_month == parsed["period_month"],
                            func.lower(ImportedSalesHistory.product_name) == parsed["product_name"].lower(),
                        )
                    )
                ).scalars().first()
                if existing:
                    for field in (
                        "product_code", "quantity_sold", "sale_amount", "purchase_quantity",
                        "purchase_amount", "profit_amount", "balance_quantity",
                    ):
                        setattr(existing, field, parsed[field])
                    existing.import_batch_id = batch.id
                    existing.source_row = row_number
                    skipped += 1
                else:
                    db.add(ImportedSalesHistory(
                        import_batch_id=batch.id,
                        source_row=row_number,
                        **{k: v for k, v in parsed.items() if k != "_row"},
                    ))
                    imported += 1
            await db.flush()
        except Exception as exc:  # keep importing remaining rows
            failed += 1
            errors.append({"row": row_number, "field": None, "message": str(exc)})

    batch.rows_total = len(raw_rows)
    batch.rows_imported = imported
    batch.rows_skipped = skipped
    batch.rows_failed = failed
    batch.status = "completed" if failed == 0 else "completed_with_errors"
    batch.summary = {"valid_rows": preview["valid_rows"], "errors": len(errors)}
    await db.commit()
    await db.refresh(batch)

    return {
        "batch_id": batch.id,
        "entity": entity,
        "file_name": filename,
        "rows_total": len(raw_rows),
        "rows_imported": imported,
        "rows_skipped": skipped,
        "rows_failed": failed,
        "errors": errors[:500],
        "summary": batch.summary or {},
    }


# ---------------------------------------------------------------------------
# Workbook parsing
# ---------------------------------------------------------------------------

def _find_month_header(ws, row: int) -> Optional[Tuple[int, int]]:
    for col in range(1, 8):
        value = ws.cell(row, col).value
        if isinstance(value, str):
            match = MONTH_RE.search(value)
            if match:
                month = _month_from_name(match.group(1))
                if month:
                    return month, int(match.group(2))
    return None


def _is_month_header_row(ws, row: int) -> bool:
    return _find_month_header(ws, row) is not None


def parse_sales_sheet(ws) -> Dict[str, Any]:
    blocks: List[Dict[str, Any]] = []
    row = 1
    while row <= ws.max_row:
        header = _find_month_header(ws, row)
        if not header:
            row += 1
            continue
        month, year = header

        header_row = row + 1
        while header_row <= min(row + 5, ws.max_row):
            if _text(ws.cell(header_row, 2).value).lower() in ("products", "product"):
                break
            header_row += 1
        if header_row > min(row + 5, ws.max_row):
            row += 1
            continue

        products: List[Dict[str, Any]] = []
        summary: Optional[Dict[str, Any]] = None
        r = header_row + 1
        while r <= ws.max_row:
            if r != row and _is_month_header_row(ws, r):
                break
            product = ws.cell(r, 2).value
            if product is None or not _text(product):
                sale_total = _num(ws.cell(r, 18).value, None)
                if sale_total is not None and summary is None:
                    summary = {
                        "period_year": year,
                        "period_month": month,
                        "total_sales": sale_total,
                        "total_purchase": _num(ws.cell(r, 5).value) or 0,
                        "total_purchase_out": _num(ws.cell(r, 20).value) or 0,
                        "total_profit": _num(ws.cell(r, 21).value) or 0,
                        "total_discount": _num(ws.cell(r, 23).value) or 0,
                        "total_expense": _num(ws.cell(r, 24).value) or 0,
                        "closing_balance_units": _num(ws.cell(r, 19).value) or 0,
                    }
                r += 1
                continue
            name = _text(product)
            if name.lower() in ("products", "product", "new coloum add", "new column add"):
                r += 1
                continue
            quantity = _num(ws.cell(r, 17).value, None)
            if quantity is None:
                quantity = sum(
                    _num(ws.cell(r, c).value) or 0 for c in range(6, 16)
                )
            purchase_qty = _num(ws.cell(r, 3).value) or 0
            purchase_amount = _num(ws.cell(r, 5).value) or 0
            purchase_rate = _num(ws.cell(r, 4).value)
            if not purchase_rate and purchase_qty:
                purchase_rate = purchase_amount / purchase_qty
            products.append({
                "period_year": year,
                "period_month": month,
                "product_name": name,
                "product_code": slug_product_code(name),
                "quantity_sold": quantity,
                "sale_amount": _num(ws.cell(r, 18).value) or 0,
                "purchase_quantity": purchase_qty,
                "purchase_amount": purchase_amount,
                "purchase_rate": purchase_rate or 0,
                "profit_amount": _num(ws.cell(r, 21).value) or 0,
                "balance_quantity": _num(ws.cell(r, 19).value) or 0,
                "sale_rate": _num(ws.cell(r, 16).value) or 0,
                "source_row": r,
            })
            r += 1

        if summary is None:
            summary = {
                "period_year": year,
                "period_month": month,
                "total_sales": sum(p["sale_amount"] for p in products),
                "total_purchase": sum(p["purchase_amount"] for p in products),
                "total_purchase_out": 0,
                "total_profit": sum(p["profit_amount"] for p in products),
                "total_discount": 0,
                "total_expense": 0,
                "closing_balance_units": sum(p["balance_quantity"] for p in products),
            }
        summary["products"] = products
        blocks.append(summary)
        row = max(r, row + 1)

    return {"months": blocks}


def _parse_roi_date_row(ws, header_row: int, current_year: int) -> Dict[int, date]:
    date_row = header_row + 1
    dates: Dict[int, date] = {}
    for col in range(8, 31):
        value = ws.cell(date_row, col).value
        parsed: Optional[date] = None
        if isinstance(value, datetime):
            parsed = value.date()
        elif isinstance(value, date):
            parsed = value
        elif isinstance(value, str):
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
                try:
                    parsed = datetime.strptime(value.strip(), fmt).date()
                    break
                except ValueError:
                    continue
        if parsed:
            if parsed.year < current_year:
                parsed = parsed.replace(year=current_year)
            dates[col] = parsed
    return dates


def parse_roi_sheet(ws) -> Dict[str, Any]:
    investments: List[Dict[str, Any]] = []
    performance: List[Dict[str, Any]] = []
    current_year = date.today().year
    row = 1
    while row <= ws.max_row:
        for col in range(1, 10):
            value = ws.cell(row, col).value
            if isinstance(value, str):
                match = YEAR_RE.search(value)
                if match:
                    current_year = int(match.group(1))

        row_label = re.sub(r"[^a-z0-9]", "", _text(ws.cell(row, 1).value).lower())
        if row_label != "sno":
            row += 1
            continue

        monthly_dates = _parse_roi_date_row(ws, row, current_year)
        r = row + 2
        while r <= ws.max_row:
            row_label_next = re.sub(r"[^a-z0-9]", "", _text(ws.cell(r, 1).value).lower())
            if row_label_next == "sno":
                break
            name = _text(ws.cell(r, 2).value)
            if not name:
                if _num(ws.cell(r, 5).value, None) is not None:
                    break
                r += 1
                continue
            if name.lower() in ("dr. name", "doctor name"):
                r += 1
                continue
            investment = _num(ws.cell(r, 5).value) or 0
            expected = _num(ws.cell(r, 7).value) or 0
            investment_date = ws.cell(r, 6).value
            if isinstance(investment_date, datetime):
                investment_date = investment_date.date()
            elif not isinstance(investment_date, date):
                investment_date = date(current_year, 1, 1)

            if investment > 0:
                roi_pct = round((investment / expected) * 100, 2) if expected else 30.0
                investments.append({
                    "name": name,
                    "specialty": _text(ws.cell(r, 3).value),
                    "area": _text(ws.cell(r, 4).value),
                    "investment_amount": investment,
                    "investment_date": investment_date,
                    "expected_sale": expected or round(investment / 0.30, 2),
                    "roi_percentage": roi_pct,
                    "source_row": r,
                })

            for col, period in monthly_dates.items():
                amount = _num(ws.cell(r, col).value) or 0
                if amount:
                    performance.append({
                        "customer_name": name,
                        "period_year": period.year,
                        "period_month": period.month,
                        "actual_sales": amount,
                        "source": "roi",
                        "source_row": r,
                    })
            r += 1
        row = max(r, row + 1)

    # "Extra Sale" block on the ROI sheet
    for r in range(1, ws.max_row + 1):
        for col in range(1, 31):
            if _text(ws.cell(r, col).value).lower() == "extra sale":
                doctor = _text(ws.cell(r - 1, col).value)
                date_value = ws.cell(r, col + 2).value
                amount = _num(ws.cell(r + 1, col + 2).value) or 0
                if isinstance(date_value, datetime):
                    date_value = date_value.date()
                if doctor and isinstance(date_value, date) and amount:
                    performance.append({
                        "customer_name": doctor,
                        "period_year": date_value.year,
                        "period_month": date_value.month,
                        "actual_sales": amount,
                        "source": "roi-extra",
                        "source_row": r,
                    })
    return {"investments": investments, "performance": performance}


def parse_olx_sheet(ws) -> Dict[str, Any]:
    customer_name = "Medicare Hospital"
    period: Optional[date] = None
    sales_total = 0.0
    products: List[Dict[str, Any]] = []
    for r in range(1, ws.max_row + 1):
        for col in range(1, 6):
            value = ws.cell(r, col).value
            if isinstance(value, str):
                match = re.search(r"FROM\s*#\s*(\d{1,2})/(\d{1,2})/(\d{4})", value, re.I)
                if match:
                    period = date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
                match = re.search(r"Dealer Code\s*#\s*[0-9\-\s]+([A-Za-z].*)", value, re.I)
                if match:
                    customer_name = match.group(1).strip()
        code = _text(ws.cell(r, 1).value)
        name = _text(ws.cell(r, 2).value)
        amount = _num(ws.cell(r, 9).value) or 0
        if code and name and amount:
            products.append({
                "product_code": code,
                "product_name": name,
                "quantity": _num(ws.cell(r, 8).value) or 0,
                "amount": amount,
                "source_row": r,
            })
            sales_total += amount
    if not period:
        period = date.today().replace(day=1)
    return {
        "customer_name": customer_name,
        "period_year": period.year,
        "period_month": period.month,
        "total_sales": round(sales_total, 2),
        "products": products,
    }


def parse_medicare_items(ws) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for r in range(1, ws.max_row + 1):
        description = _text(ws.cell(r, 42).value)  # AP
        amount = _num(ws.cell(r, 46).value) or 0  # AT
        if description and amount:
            items.append({"description": description, "amount": amount, "source_row": r})
    return items


def parse_workbook(content: bytes, filename: str) -> Dict[str, Any]:
    wb = load_workbook(io.BytesIO(content), data_only=True)
    try:
        if "Sales Sheet" not in wb.sheetnames:
            raise ValidationError("Workbook must contain a 'Sales Sheet' worksheet")
        sales = parse_sales_sheet(wb["Sales Sheet"])
        roi = parse_roi_sheet(wb["ROi Sheet"]) if "ROi Sheet" in wb.sheetnames else {"investments": [], "performance": []}
        olx = parse_olx_sheet(wb["OLX"]) if "OLX" in wb.sheetnames else None
        medicare = parse_medicare_items(wb["ROi Sheet"]) if "ROi Sheet" in wb.sheetnames else []
    finally:
        wb.close()

    months = sales["months"]
    total_sales = round(sum(m["total_sales"] for m in months), 2)
    total_profit = round(sum(m["total_profit"] for m in months), 2)
    unique_products = {
        p["product_name"].strip().lower(): p
        for m in months for p in m["products"]
    }
    return {
        "file_name": filename,
        "months": months,
        "investments": roi["investments"],
        "performance": roi["performance"],
        "olx": olx,
        "medicare_items": medicare,
        "totals": {
            "months": len(months),
            "products": len(unique_products),
            "sales_rows": sum(len(m["products"]) for m in months),
            "total_sales": total_sales,
            "total_profit": total_profit,
            "investments": len(roi["investments"]),
            "performance_rows": len(roi["performance"]),
            "olx_total": (olx or {}).get("total_sales", 0),
            "medicare_items_total": round(sum(i["amount"] for i in medicare), 2),
        },
    }


def preview_workbook(content: bytes, filename: str, max_rows: int = 60) -> Dict[str, Any]:
    parsed = parse_workbook(content, filename)
    month_rows = [
        {
            "period": f"{m['period_month']:02d}/{m['period_year']}",
            "products": len(m["products"]),
            "total_sales": round(m["total_sales"], 2),
            "total_purchase": round(m["total_purchase"], 2),
            "total_profit": round(m["total_profit"], 2),
            "total_discount": round(m["total_discount"], 2),
            "total_expense": round(m["total_expense"], 2),
        }
        for m in parsed["months"][:max_rows]
    ]
    return {
        "entity": "workbook",
        "file_name": filename,
        "sheet_name": "Sales Sheet",
        "headers": ["period", "products", "total_sales", "total_purchase", "total_profit", "total_discount", "total_expense"],
        "total_rows": parsed["totals"]["sales_rows"],
        "valid_rows": parsed["totals"]["sales_rows"],
        "invalid_rows": 0,
        "rows": month_rows,
        "errors": [],
        "warnings": [
            "Historical monthly sales are imported as performance records only; they do not create sales invoices.",
            "Opening stock is created from each product's latest closing balance in the workbook.",
        ],
        "totals": parsed["totals"],
        "investments": parsed["investments"][:max_rows],
        "olx": parsed["olx"],
        "medicare_items": parsed["medicare_items"],
    }


# ---------------------------------------------------------------------------
# Workbook commit
# ---------------------------------------------------------------------------

async def _upsert_customer(
    db: AsyncSession,
    name: str,
    customer_type: str = "doctor",
    specialty: Optional[str] = None,
    area: Optional[str] = None,
    user_id: Optional[UUID] = None,
    cache: Optional[Dict[str, Customer]] = None,
) -> Customer:
    cache = cache if cache is not None else {}
    key = name.strip().lower()
    if key in cache:
        return cache[key]
    existing = (
        await db.execute(select(Customer).where(func.lower(Customer.name) == key))
    ).scalars().first()
    if existing:
        if specialty and not existing.specialty:
            existing.specialty = specialty
        if area and not existing.area:
            existing.area = area
        cache[key] = existing
        return existing
    created = Customer(
        name=name.strip(),
        customer_type=customer_type,
        specialty=specialty or None,
        area=area or None,
        created_by=user_id,
    )
    db.add(created)
    await db.flush()
    cache[key] = created
    return created


async def commit_workbook(
    db: AsyncSession,
    content: bytes,
    filename: str,
    user_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    parsed = parse_workbook(content, filename)

    batch = ImportBatch(
        source_file=filename,
        source_sheet="Sales Sheet",
        import_type="workbook",
        status="processing",
        created_by=user_id,
    )
    db.add(batch)
    await db.flush()

    # 1. Owner settings
    owner = (await db.execute(select(OwnerSettings))).scalars().first()
    if not owner:
        db.add(OwnerSettings(
            business_name="Walmus Pharma",
            business_address="Gujrat",
            currency="PKR",
            financial_year_start_month=7,
            default_tax_rate=0,
        ))
    elif owner.business_name in ("", "Business Name"):
        owner.business_name = "Walmus Pharma"

    # 2. Supplier
    supplier = (
        await db.execute(select(Supplier).where(func.lower(Supplier.name) == "ma distributor"))
    ).scalars().first()
    if not supplier:
        supplier = Supplier(name="MA Distributor", contact_person="MA Distributor", created_by=user_id)
        db.add(supplier)
        await db.flush()

    # 3. Units and medicines
    units = {u.code: u for u in (await db.execute(select(MedicineUnit))).scalars().all()}
    customer_cache: Dict[str, Customer] = {}
    medicine_cache: Dict[str, Medicine] = {}
    latest_products: Dict[str, Dict[str, Any]] = {}

    for month in parsed["months"]:
        for product in month["products"]:
            key = product["product_name"].strip().lower()
            latest_products[key] = product
            if key in medicine_cache:
                continue
            existing = (
                await db.execute(
                    select(Medicine).where(
                        (func.lower(Medicine.name) == key)
                        | (Medicine.product_code == product["product_code"])
                    )
                )
            ).scalars().first()
            if existing:
                existing.default_purchase_rate = product["purchase_rate"] or existing.default_purchase_rate
                existing.default_sale_rate = product["sale_rate"] or existing.default_sale_rate
                medicine_cache[key] = existing
                continue
            unit = units.get(_unit_code_for(product["product_name"])) or units.get("TAB")
            if not unit:
                raise ValidationError("No medicine units are configured")
            medicine = Medicine(
                product_code=product["product_code"],
                name=product["product_name"].strip(),
                base_unit_id=unit.id,
                units_per_pack=1,
                purchase_unit_id=unit.id,
                purchase_conversion_factor=1,
                sale_unit_id=unit.id,
                sale_conversion_factor=1,
                default_purchase_rate=product["purchase_rate"] or 0,
                default_sale_rate=product["sale_rate"] or 0,
                is_active=True,
                created_by=user_id,
            )
            db.add(medicine)
            await db.flush()
            medicine_cache[key] = medicine

    # 4. Historical sales + monthly summaries
    sales_imported = 0
    sales_skipped = 0
    for month in parsed["months"]:
        for product in month["products"]:
            existing = (
                await db.execute(
                    select(ImportedSalesHistory).where(
                        ImportedSalesHistory.period_year == month["period_year"],
                        ImportedSalesHistory.period_month == month["period_month"],
                        func.lower(ImportedSalesHistory.product_name) == product["product_name"].strip().lower(),
                    )
                )
            ).scalars().first()
            if existing:
                existing.import_batch_id = batch.id
                existing.product_code = product["product_code"]
                existing.quantity_sold = product["quantity_sold"]
                existing.sale_amount = product["sale_amount"]
                existing.purchase_quantity = product["purchase_quantity"]
                existing.purchase_amount = product["purchase_amount"]
                existing.profit_amount = product["profit_amount"]
                existing.balance_quantity = product["balance_quantity"]
                existing.source_row = product["source_row"]
                sales_skipped += 1
            else:
                db.add(ImportedSalesHistory(
                    import_batch_id=batch.id,
                    period_year=month["period_year"],
                    period_month=month["period_month"],
                    product_name=product["product_name"].strip(),
                    product_code=product["product_code"],
                    quantity_sold=product["quantity_sold"],
                    sale_amount=product["sale_amount"],
                    purchase_quantity=product["purchase_quantity"],
                    purchase_amount=product["purchase_amount"],
                    profit_amount=product["profit_amount"],
                    balance_quantity=product["balance_quantity"],
                    source_row=product["source_row"],
                ))
                sales_imported += 1

        existing_summary = (
            await db.execute(
                select(ImportedMonthSummary).where(
                    ImportedMonthSummary.period_year == month["period_year"],
                    ImportedMonthSummary.period_month == month["period_month"],
                )
            )
        ).scalars().first()
        if existing_summary:
            existing_summary.import_batch_id = batch.id
            existing_summary.total_sales = month["total_sales"]
            existing_summary.total_purchase = month["total_purchase"]
            existing_summary.total_purchase_out = month["total_purchase_out"]
            existing_summary.total_profit = month["total_profit"]
            existing_summary.total_discount = month["total_discount"]
            existing_summary.total_expense = month["total_expense"]
            existing_summary.closing_balance_units = month["closing_balance_units"]
        else:
            db.add(ImportedMonthSummary(
                import_batch_id=batch.id,
                period_year=month["period_year"],
                period_month=month["period_month"],
                total_sales=month["total_sales"],
                total_purchase=month["total_purchase"],
                total_purchase_out=month["total_purchase_out"],
                total_profit=month["total_profit"],
                total_discount=month["total_discount"],
                total_expense=month["total_expense"],
                closing_balance_units=month["closing_balance_units"],
            ))
    await db.flush()

    # 5. Customers from ROI + OLX
    for investment in parsed["investments"]:
        name = investment["name"]
        customer_type = "hospital" if "hospital" in name.lower() else "doctor"
        await _upsert_customer(
            db, name, customer_type, investment["specialty"] or None,
            investment["area"] or None, user_id, customer_cache,
        )
    if parsed["olx"]:
        olx_name = parsed["olx"]["customer_name"]
        await _upsert_customer(db, olx_name, "hospital", None, "Gujrat", user_id, customer_cache)

    # 6. Customer performance
    performance_rows = list(parsed["performance"])
    if parsed["olx"] and parsed["olx"]["total_sales"]:
        performance_rows.append({
            "customer_name": parsed["olx"]["customer_name"],
            "period_year": parsed["olx"]["period_year"],
            "period_month": parsed["olx"]["period_month"],
            "actual_sales": parsed["olx"]["total_sales"],
            "source": "olx",
            "source_row": None,
        })
    performance_imported = 0
    for item in performance_rows:
        customer = await _upsert_customer(
            db, item["customer_name"], "doctor", None, None, user_id, customer_cache
        )
        existing = (
            await db.execute(
                select(ImportedCustomerPerformance).where(
                    func.lower(ImportedCustomerPerformance.customer_name) == item["customer_name"].strip().lower(),
                    ImportedCustomerPerformance.period_year == item["period_year"],
                    ImportedCustomerPerformance.period_month == item["period_month"],
                    ImportedCustomerPerformance.source == item["source"],
                )
            )
        ).scalars().first()
        if existing:
            existing.actual_sales = item["actual_sales"]
            existing.customer_id = customer.id
            existing.import_batch_id = batch.id
        else:
            db.add(ImportedCustomerPerformance(
                import_batch_id=batch.id,
                customer_id=customer.id,
                customer_name=item["customer_name"].strip(),
                period_year=item["period_year"],
                period_month=item["period_month"],
                actual_sales=item["actual_sales"],
                source=item["source"],
                source_row=item.get("source_row"),
            ))
            performance_imported += 1
    await db.flush()

    # 6b. OLX distributor totals are stored as customer performance only.
    # They are intentionally NOT added to product-level sales history, because the
    # Sales Sheet already contains product sales for the same periods.

    # 7. Opening stock from latest closing balance
    latest_month = max(parsed["months"], key=lambda m: (m["period_year"], m["period_month"]), default=None)
    batches_created = 0
    if latest_month:
        batch_number = f"OPEN-{latest_month['period_year']}{latest_month['period_month']:02d}"
        for product in latest_month["products"]:
            balance = product["balance_quantity"]
            if balance <= 0:
                continue
            medicine = medicine_cache.get(product["product_name"].strip().lower())
            if not medicine:
                continue
            existing_batch = (
                await db.execute(
                    select(MedicineBatch).where(
                        MedicineBatch.medicine_id == medicine.id,
                        MedicineBatch.batch_number == batch_number,
                        MedicineBatch.supplier_id == supplier.id,
                    )
                )
            ).scalars().first()
            if existing_batch:
                continue
            db.add(MedicineBatch(
                medicine_id=medicine.id,
                batch_number=batch_number,
                expiry_date=date.today().replace(year=date.today().year + 2),
                supplier_id=supplier.id,
                received_quantity=balance,
                available_quantity=balance,
                purchase_cost_per_unit=product["purchase_rate"] or 0,
                status="active",
                location="MAIN",
                notes="Imported closing balance from Sale Sheet MA-Na.xlsx",
            ))
            batches_created += 1
        await db.flush()

    # 8. Investments and disbursement transactions
    investments_created = 0
    for item in parsed["investments"]:
        customer = await _upsert_customer(
            db, item["name"], "doctor", item["specialty"] or None,
            item["area"] or None, user_id, customer_cache,
        )
        existing = (
            await db.execute(
                select(DoctorInvestment).where(
                    DoctorInvestment.customer_id == customer.id,
                    DoctorInvestment.investment_date == item["investment_date"],
                    DoctorInvestment.investment_amount == item["investment_amount"],
                )
            )
        ).scalars().first()
        if existing:
            continue
        investment = DoctorInvestment(
            customer_id=customer.id,
            investment_amount=item["investment_amount"],
            investment_date=item["investment_date"],
            roi_percentage=item["roi_percentage"],
            expected_sale=item["expected_sale"],
            status="active",
            notes="Imported from ROI sheet",
            created_by=user_id,
        )
        db.add(investment)
        await db.flush()
        db.add(InvestmentTransaction(
            investment_id=investment.id,
            transaction_type="disbursement",
            amount=item["investment_amount"],
            transaction_date=item["investment_date"],
            payment_method="cash",
            reference_number=f"IMPORT-{investment.id.hex[:8].upper()}",
            notes="Imported opening investment",
            created_by=user_id,
        ))
        investments_created += 1

    # 9. Imported monthly operating expenses
    expense_category = (
        await db.execute(select(ExpenseCategory).where(ExpenseCategory.code == "OTHER"))
    ).scalars().first()
    expense_account = (
        await db.execute(select(FinancialAccount).where(FinancialAccount.code == "EXPENSE"))
    ).scalars().first()
    cash_account = (
        await db.execute(select(FinancialAccount).where(FinancialAccount.code == "CASH"))
    ).scalars().first()
    expenses_created = 0
    if expense_category and (expense_account or cash_account):
        for month in parsed["months"]:
            amount = month["total_expense"]
            if amount <= 0:
                continue
            expense_number = f"IMP-EXP-{month['period_year']}{month['period_month']:02d}"
            existing = (
                await db.execute(select(Expense).where(Expense.expense_number == expense_number))
            ).scalars().first()
            if existing:
                continue
            db.add(Expense(
                expense_number=expense_number,
                expense_date=date(month["period_year"], month["period_month"], 28),
                category_id=expense_category.id,
                account_id=(expense_account or cash_account).id,
                amount=amount,
                description="Imported monthly operating expense from Sales Sheet",
                status="posted",
                created_by=user_id,
            ))
            expenses_created += 1

    totals = parsed["totals"]
    batch.rows_total = totals["sales_rows"]
    batch.rows_imported = sales_imported
    batch.rows_skipped = sales_skipped
    batch.rows_failed = 0
    batch.status = "completed"
    batch.summary = {
        **totals,
        "medicines": len(medicine_cache),
        "investments_created": investments_created,
        "performance_rows_imported": performance_imported,
        "opening_batches_created": batches_created,
        "expenses_created": expenses_created,
        "medicare_items": parsed["medicare_items"],
        "olx": parsed["olx"],
    }
    await db.commit()
    await db.refresh(batch)

    return {
        "batch_id": batch.id,
        "entity": "workbook",
        "file_name": filename,
        "rows_total": batch.rows_total,
        "rows_imported": sales_imported,
        "rows_skipped": sales_skipped,
        "rows_failed": 0,
        "errors": [],
        "summary": batch.summary or {},
    }


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

def workbook_bytes(title: str, headers: List[str], rows: Iterable[Iterable[Any]], sheet_name: str = "Data") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31]
    ws.append(headers)
    for row in rows:
        ws.append([
            float(value) if isinstance(value, Decimal) else value
            for value in row
        ])
    for index, header in enumerate(headers, start=1):
        ws.column_dimensions[get_column_letter(index)].width = max(12, min(40, len(str(header)) + 4))
    ws.freeze_panes = "A2"
    stream = io.BytesIO()
    wb.save(stream)
    return stream.getvalue()


def csv_bytes(headers: List[str], rows: Iterable[Iterable[Any]]) -> bytes:
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(headers)
    for row in rows:
        writer.writerow([float(v) if isinstance(v, Decimal) else v for v in row])
    return stream.getvalue().encode("utf-8-sig")


async def export_entity(db: AsyncSession, entity: str) -> Tuple[bytes, str, str]:
    """Return (content, media_type, filename) for a data export."""
    if entity not in SUPPORTED_EXPORT_ENTITIES:
        raise ValidationError(f"Unsupported export entity: {entity}")
    today = date.today().isoformat()

    if entity == "medicines":
        headers = ["Product Code", "Name", "Generic Name", "Strength", "Dosage Form", "Packing", "Purchase Rate", "Sale Rate", "Reorder Level", "Active"]
        result = await db.execute(select(Medicine).order_by(Medicine.name))
        rows = [
            (m.product_code, m.name, m.generic_name, m.strength, m.dosage_form,
             m.packing_description, m.default_purchase_rate, m.default_sale_rate,
             m.reorder_level, "Yes" if m.is_active else "No")
            for m in result.scalars().all()
        ]
    elif entity == "customers":
        headers = ["Name", "Type", "Specialty", "Area", "Phone", "Address", "Opening Balance", "Active"]
        result = await db.execute(select(Customer).order_by(Customer.name))
        rows = [
            (c.name, c.customer_type, c.specialty, c.area, c.phone, c.address,
             c.opening_balance, "Yes" if c.is_active else "No")
            for c in result.scalars().all()
        ]
    elif entity == "suppliers":
        headers = ["Name", "Contact Person", "Phone", "Email", "Address", "Opening Balance", "Payment Terms Days", "Active"]
        result = await db.execute(select(Supplier).order_by(Supplier.name))
        rows = [
            (s.name, s.contact_person, s.phone, s.email, s.address,
             s.opening_balance, s.payment_terms_days, "Yes" if s.is_active else "No")
            for s in result.scalars().all()
        ]
    elif entity == "inventory":
        headers = ["Product Code", "Medicine", "Batch", "Expiry", "Supplier", "Received", "Available", "Cost/Unit", "Stock Value", "Status"]
        result = await db.execute(
            select(MedicineBatch, Medicine, Supplier)
            .join(Medicine, Medicine.id == MedicineBatch.medicine_id)
            .outerjoin(Supplier, Supplier.id == MedicineBatch.supplier_id)
            .order_by(Medicine.name, MedicineBatch.expiry_date)
        )
        rows = [
            (medicine.product_code, medicine.name, batch.batch_number, batch.expiry_date,
             supplier.name if supplier else "", batch.received_quantity, batch.available_quantity,
             batch.purchase_cost_per_unit,
             Decimal(str(batch.available_quantity)) * Decimal(str(batch.purchase_cost_per_unit)),
             batch.status)
            for batch, medicine, supplier in result.all()
        ]
    elif entity == "sales":
        headers = ["Invoice", "Date", "Customer", "Status", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance"]
        result = await db.execute(
            select(SalesInvoice, Customer)
            .outerjoin(Customer, Customer.id == SalesInvoice.customer_id)
            .order_by(SalesInvoice.invoice_date.desc())
        )
        rows = [
            (inv.invoice_number, inv.invoice_date, customer.name if customer else "", inv.status,
             inv.subtotal, inv.discount_amount, inv.tax_amount, inv.total_amount,
             inv.amount_paid, inv.balance_amount)
            for inv, customer in result.all()
        ]
    elif entity == "purchases":
        headers = ["Voucher", "Date", "Supplier", "Status", "Subtotal", "Discount", "Tax", "Total", "Paid", "Balance"]
        result = await db.execute(
            select(PurchaseInvoice, Supplier)
            .outerjoin(Supplier, Supplier.id == PurchaseInvoice.supplier_id)
            .order_by(PurchaseInvoice.invoice_date.desc())
        )
        rows = [
            (inv.voucher_number, inv.invoice_date, supplier.name if supplier else "", inv.status,
             inv.subtotal, inv.discount_amount, inv.tax_amount, inv.total_amount,
             inv.amount_paid, inv.balance_amount)
            for inv, supplier in result.all()
        ]
    elif entity == "expenses":
        headers = ["Expense #", "Date", "Category", "Description", "Amount", "Tax", "Status"]
        result = await db.execute(
            select(Expense, ExpenseCategory)
            .join(ExpenseCategory, ExpenseCategory.id == Expense.category_id)
            .order_by(Expense.expense_date.desc())
        )
        rows = [
            (exp.expense_number, exp.expense_date, category.name, exp.description,
             exp.amount, exp.tax_amount, exp.status)
            for exp, category in result.all()
        ]
    elif entity == "investments":
        headers = ["Doctor", "Specialty", "Area", "Investment", "Date", "ROI %", "Expected Sale", "Status"]
        result = await db.execute(
            select(DoctorInvestment, Customer)
            .join(Customer, Customer.id == DoctorInvestment.customer_id)
            .order_by(Customer.name, DoctorInvestment.investment_date)
        )
        rows = [
            (customer.name, customer.specialty, customer.area, inv.investment_amount,
             inv.investment_date, inv.roi_percentage, inv.expected_sale, inv.status)
            for inv, customer in result.all()
        ]
    elif entity == "sales-history":
        headers = ["Year", "Month", "Product", "Product Code", "Qty Sold", "Sale Amount", "Purchase Qty", "Purchase Amount", "Profit", "Balance Qty"]
        result = await db.execute(
            select(ImportedSalesHistory)
            .order_by(ImportedSalesHistory.period_year, ImportedSalesHistory.period_month, ImportedSalesHistory.product_name)
        )
        rows = [
            (h.period_year, h.period_month, h.product_name, h.product_code, h.quantity_sold,
             h.sale_amount, h.purchase_quantity, h.purchase_amount, h.profit_amount, h.balance_quantity)
            for h in result.scalars().all()
        ]
    else:  # month-summary
        headers = ["Year", "Month", "Total Sales", "Total Purchase", "Purchase Out", "Profit", "Discount", "Expense", "Closing Units"]
        result = await db.execute(
            select(ImportedMonthSummary).order_by(
                ImportedMonthSummary.period_year, ImportedMonthSummary.period_month
            )
        )
        rows = [
            (m.period_year, m.period_month, m.total_sales, m.total_purchase,
             m.total_purchase_out, m.total_profit, m.total_discount,
             m.total_expense, m.closing_balance_units)
            for m in result.scalars().all()
        ]

    title = entity.replace("-", " ").title()
    return (
        workbook_bytes(title, headers, rows),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        f"{entity}-{today}.xlsx",
    )
