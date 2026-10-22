"""Excel/CSV import and export API endpoints."""
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ValidationError
from app.core.security import get_current_user
from app.models import ImportBatch, ImportedCustomerPerformance, ImportedMonthSummary, ImportedSalesHistory
from app.services import excel_import_export as service

router = APIRouter()

MAX_UPLOAD_BYTES = 25 * 1024 * 1024


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read()
    if not content:
        raise ValidationError("The uploaded file is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValidationError("The uploaded file is larger than 25 MB")
    return content


@router.get("/entities")
async def list_entities(current_user=Depends(get_current_user)):
    """List import/export entities and their template columns."""
    return {
        "import": list(service.SUPPORTED_IMPORT_ENTITIES),
        "export": list(service.SUPPORTED_EXPORT_ENTITIES),
        "templates": service.TEMPLATES,
    }


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.get("/templates/{entity}")
async def download_template(
    entity: str,
    current_user=Depends(get_current_user),
):
    """Download an empty XLSX template for an entity."""
    if entity not in service.TEMPLATES:
        raise ValidationError(f"No template is available for '{entity}'")
    headers = service.TEMPLATES[entity]
    content = service.workbook_bytes(
        f"{entity.title()} Template",
        headers,
        [],
        sheet_name=entity.replace("-", "_").title()[:31],
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{entity}-template.xlsx"'},
    )


# ---------------------------------------------------------------------------
# Generic entity import
# ---------------------------------------------------------------------------

@router.post("/preview")
async def preview_import(
    entity: str = Query(..., description="medicines | customers | suppliers | sales-history"),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Parse and validate an uploaded CSV/XLSX file without saving anything."""
    content = await _read_upload(file)
    return service.preview_entity(entity, content, file.filename or "upload.xlsx")


@router.post("/commit")
async def commit_import(
    entity: str = Query(..., description="medicines | customers | suppliers | sales-history"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Validate and commit an uploaded CSV/XLSX file (idempotent upsert)."""
    content = await _read_upload(file)
    return await service.commit_entity(
        db, entity, content, file.filename or "upload.xlsx", current_user.id
    )


# ---------------------------------------------------------------------------
# Full workbook seed import
# ---------------------------------------------------------------------------

@router.post("/workbook/preview")
async def preview_workbook(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Preview the Sale Sheet MA-Na workbook before committing it."""
    content = await _read_upload(file)
    return service.preview_workbook(content, file.filename or "Sale Sheet MA-Na.xlsx")


@router.post("/workbook/commit")
async def commit_workbook(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Seed master data, opening stock, investments and historical sales from the workbook."""
    content = await _read_upload(file)
    return await service.commit_workbook(
        db, content, file.filename or "Sale Sheet MA-Na.xlsx", current_user.id
    )


# ---------------------------------------------------------------------------
# History and exports
# ---------------------------------------------------------------------------

@router.get("/batches")
async def list_batches(
    limit: int = Query(25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(limit)
    )
    return [
        {
            "id": str(batch.id),
            "source_file": batch.source_file,
            "source_sheet": batch.source_sheet,
            "import_type": batch.import_type,
            "status": batch.status,
            "rows_total": batch.rows_total,
            "rows_imported": batch.rows_imported,
            "rows_skipped": batch.rows_skipped,
            "rows_failed": batch.rows_failed,
            "summary": batch.summary,
            "notes": batch.notes,
            "created_at": batch.created_at,
        }
        for batch in result.scalars().all()
    ]


@router.get("/history")
async def import_history(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Summary of imported historical data."""
    months = (
        await db.execute(
            select(ImportedMonthSummary).order_by(
                ImportedMonthSummary.period_year, ImportedMonthSummary.period_month
            )
        )
    ).scalars().all()
    batch_count = (
        await db.execute(select(func.count(ImportBatch.id)))
    ).scalar() or 0
    sales_row_count = (
        await db.execute(select(func.count(ImportedSalesHistory.id)))
    ).scalar() or 0
    performance_count = (
        await db.execute(select(func.count(ImportedCustomerPerformance.id)))
    ).scalar() or 0
    total_sales = sum(float(m.total_sales) for m in months)
    last_batch = (
        await db.execute(select(ImportBatch).order_by(ImportBatch.created_at.desc()).limit(1))
    ).scalars().first()
    return {
        "batches": batch_count,
        "sales_rows": sales_row_count,
        "performance_rows": performance_count,
        "total_imported_sales": total_sales,
        "source_file": last_batch.source_file if last_batch else None,
        "months": [
            {
                "period": f"{m.period_month:02d}/{m.period_year}",
                "period_year": m.period_year,
                "period_month": m.period_month,
                "total_sales": float(m.total_sales),
                "total_purchase": float(m.total_purchase),
                "total_purchase_out": float(m.total_purchase_out),
                "total_profit": float(m.total_profit),
                "total_discount": float(m.total_discount),
                "total_expense": float(m.total_expense),
                "closing_balance_units": float(m.closing_balance_units),
            }
            for m in months
        ],
    }


@router.get("/exports/{entity}")
async def export_data(
    entity: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Download an XLSX export of master data or transaction history."""
    content, media_type, filename = await service.export_entity(db, entity)
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"
            )
        },
    )
