"""Medicines API endpoints."""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models import Medicine, Manufacturer, MedicineUnit
from app.models.enums import InvoiceStatus
from app.schemas.medicines import (
    MedicineCreate,
    MedicineUpdate,
    MedicineResponse,
    MedicineListResponse,
    ManufacturerCreate,
    ManufacturerUpdate,
    ManufacturerResponse,
    MedicineUnitCreate,
    MedicineUnitUpdate,
    MedicineUnitResponse,
)
from app.core.exceptions import NotFoundError, ConflictError, ValidationError as AppValidationError

router = APIRouter()


# ===========================================
# Manufacturer Endpoints
# ===========================================

@router.post("/manufacturers", response_model=ManufacturerResponse, status_code=status.HTTP_201_CREATED)
async def create_manufacturer(
    data: ManufacturerCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new manufacturer."""
    # Check duplicate name
    result = await db.execute(select(Manufacturer).where(Manufacturer.name == data.name))
    if result.scalar_one_or_none():
        raise ConflictError(f"Manufacturer '{data.name}' already exists")
    
    manufacturer = Manufacturer(**data.model_dump())
    db.add(manufacturer)
    await db.commit()
    await db.refresh(manufacturer)
    return ManufacturerResponse.model_validate(manufacturer)


@router.get("/manufacturers", response_model=list[ManufacturerResponse])
async def list_manufacturers(
    search: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List manufacturers with search and filter."""
    query = select(Manufacturer)
    
    if search:
        query = query.where(Manufacturer.name.ilike(f"%{search}%"))
    if is_active is not None:
        query = query.where(Manufacturer.is_active == is_active)
    
    query = query.order_by(Manufacturer.name).limit(limit).offset(offset)
    result = await db.execute(query)
    return [ManufacturerResponse.model_validate(m) for m in result.scalars().all()]


@router.get("/manufacturers/{manufacturer_id}", response_model=ManufacturerResponse)
async def get_manufacturer(
    manufacturer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get manufacturer by ID."""
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    manufacturer = result.scalar_one_or_none()
    if not manufacturer:
        raise NotFoundError("Manufacturer", str(manufacturer_id))
    return ManufacturerResponse.model_validate(manufacturer)


@router.patch("/manufacturers/{manufacturer_id}", response_model=ManufacturerResponse)
async def update_manufacturer(
    manufacturer_id: UUID,
    data: ManufacturerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update manufacturer."""
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    manufacturer = result.scalar_one_or_none()
    if not manufacturer:
        raise NotFoundError("Manufacturer", str(manufacturer_id))
    
    # Check duplicate name if changed
    if data.name and data.name != manufacturer.name:
        existing = await db.execute(select(Manufacturer).where(Manufacturer.name == data.name))
        if existing.scalar_one_or_none():
            raise ConflictError(f"Manufacturer '{data.name}' already exists")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(manufacturer, field, value)
    
    await db.commit()
    await db.refresh(manufacturer)
    return ManufacturerResponse.model_validate(manufacturer)


@router.delete("/manufacturers/{manufacturer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manufacturer(
    manufacturer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete manufacturer (soft delete - set inactive)."""
    result = await db.execute(select(Manufacturer).where(Manufacturer.id == manufacturer_id))
    manufacturer = result.scalar_one_or_none()
    if not manufacturer:
        raise NotFoundError("Manufacturer", str(manufacturer_id))
    
    # Check if used by medicines
    med_result = await db.execute(select(func.count(Medicine.id)).where(Medicine.manufacturer_id == manufacturer_id))
    if med_result.scalar() > 0:
        manufacturer.is_active = False
        await db.commit()
        return
    
    await db.delete(manufacturer)
    await db.commit()


# ===========================================
# Medicine Unit Endpoints
# ===========================================

@router.post("/units", response_model=MedicineUnitResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine_unit(
    data: MedicineUnitCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new medicine unit."""
    result = await db.execute(select(MedicineUnit).where(MedicineUnit.code == data.code))
    if result.scalar_one_or_none():
        raise ConflictError(f"Unit code '{data.code}' already exists")
    
    # If this is a base unit, ensure no other base unit exists (per medicine, but globally we allow multiple)
    unit = MedicineUnit(**data.model_dump())
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return MedicineUnitResponse.model_validate(unit)


@router.get("/units", response_model=list[MedicineUnitResponse])
async def list_medicine_units(
    is_active: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List medicine units."""
    query = select(MedicineUnit).order_by(MedicineUnit.sort_order, MedicineUnit.code)
    result = await db.execute(query)
    return [MedicineUnitResponse.model_validate(u) for u in result.scalars().all()]


@router.get("/units/{unit_id}", response_model=MedicineUnitResponse)
async def get_medicine_unit(
    unit_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get medicine unit by ID."""
    result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise NotFoundError("Medicine Unit", str(unit_id))
    return MedicineUnitResponse.model_validate(unit)


@router.patch("/units/{unit_id}", response_model=MedicineUnitResponse)
async def update_medicine_unit(
    unit_id: UUID,
    data: MedicineUnitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update medicine unit."""
    result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == unit_id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise NotFoundError("Medicine Unit", str(unit_id))
    
    if data.code and data.code != unit.code:
        existing = await db.execute(select(MedicineUnit).where(MedicineUnit.code == data.code))
        if existing.scalar_one_or_none():
            raise ConflictError(f"Unit code '{data.code}' already exists")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    
    await db.commit()
    await db.refresh(unit)
    return MedicineUnitResponse.model_validate(unit)


# ===========================================
# Medicine Endpoints
# ===========================================

@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def create_medicine(
    data: MedicineCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Create a new medicine."""
    # Check duplicate product_code
    result = await db.execute(select(Medicine).where(Medicine.product_code == data.product_code))
    if result.scalar_one_or_none():
        raise ConflictError(f"Product code '{data.product_code}' already exists")
    
    if data.barcode:
        result = await db.execute(select(Medicine).where(Medicine.barcode == data.barcode))
        if result.scalar_one_or_none():
            raise ConflictError(f"Barcode '{data.barcode}' already exists")
    
    # Validate units exist
    for unit_field in ['base_unit_id', 'purchase_unit_id', 'sale_unit_id']:
        unit_id = getattr(data, unit_field)
        if unit_id:
            unit_result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == unit_id))
            if not unit_result.scalar_one_or_none():
                raise NotFoundError("Medicine Unit", str(unit_id))
    
    if data.manufacturer_id:
        man_result = await db.execute(select(Manufacturer).where(Manufacturer.id == data.manufacturer_id))
        if not man_result.scalar_one_or_none():
            raise NotFoundError("Manufacturer", str(data.manufacturer_id))
    
    medicine = Medicine(**data.model_dump(), created_by=current_user.id)
    db.add(medicine)
    await db.commit()
    result = await db.execute(
        select(Medicine)
        .options(
            selectinload(Medicine.manufacturer),
            selectinload(Medicine.base_unit),
            selectinload(Medicine.purchase_unit),
            selectinload(Medicine.sale_unit),
        )
        .where(Medicine.id == medicine.id)
    )
    return MedicineResponse.model_validate(result.scalar_one())


@router.get("", response_model=MedicineListResponse)
async def list_medicines(
    search: Optional[str] = Query(None),
    manufacturer_id: Optional[UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    low_stock: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("name"),
    sort_order: str = Query("asc"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """List medicines with search, filter, pagination."""
    query = select(Medicine).options(
        selectinload(Medicine.manufacturer),
        selectinload(Medicine.base_unit),
        selectinload(Medicine.purchase_unit),
        selectinload(Medicine.sale_unit),
    )
    
    if search:
        query = query.where(
            or_(
                Medicine.name.ilike(f"%{search}%"),
                Medicine.product_code.ilike(f"%{search}%"),
                Medicine.barcode.ilike(f"%{search}%"),
                Medicine.generic_name.ilike(f"%{search}%"),
            )
        )
    if manufacturer_id:
        query = query.where(Medicine.manufacturer_id == manufacturer_id)
    if is_active is not None:
        query = query.where(Medicine.is_active == is_active)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Sorting
    sort_column = getattr(Medicine, sort_by, Medicine.name)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
    
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    medicines = result.scalars().all()
    
    return MedicineListResponse(
        items=[MedicineResponse.model_validate(m) for m in medicines],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{medicine_id}", response_model=MedicineResponse)
async def get_medicine(
    medicine_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get medicine by ID with related data."""
    result = await db.execute(
        select(Medicine)
        .options(
            selectinload(Medicine.manufacturer),
            selectinload(Medicine.base_unit),
            selectinload(Medicine.purchase_unit),
            selectinload(Medicine.sale_unit),
        )
        .where(Medicine.id == medicine_id)
    )
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise NotFoundError("Medicine", str(medicine_id))
    return MedicineResponse.model_validate(medicine)


@router.patch("/{medicine_id}", response_model=MedicineResponse)
async def update_medicine(
    medicine_id: UUID,
    data: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Update medicine."""
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise NotFoundError("Medicine", str(medicine_id))
    
    # Check duplicate product_code if changed
    if data.product_code and data.product_code != medicine.product_code:
        existing = await db.execute(select(Medicine).where(Medicine.product_code == data.product_code))
        if existing.scalar_one_or_none():
            raise ConflictError(f"Product code '{data.product_code}' already exists")
    
    if data.barcode and data.barcode != medicine.barcode:
        existing = await db.execute(select(Medicine).where(Medicine.barcode == data.barcode))
        if existing.scalar_one_or_none():
            raise ConflictError(f"Barcode '{data.barcode}' already exists")
    
    # Validate units
    for unit_field in ['base_unit_id', 'purchase_unit_id', 'sale_unit_id']:
        unit_id = getattr(data, unit_field)
        if unit_id:
            unit_result = await db.execute(select(MedicineUnit).where(MedicineUnit.id == unit_id))
            if not unit_result.scalar_one_or_none():
                raise NotFoundError("Medicine Unit", str(unit_id))
    
    if data.manufacturer_id:
        man_result = await db.execute(select(Manufacturer).where(Manufacturer.id == data.manufacturer_id))
        if not man_result.scalar_one_or_none():
            raise NotFoundError("Manufacturer", str(data.manufacturer_id))
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(medicine, field, value)
    
    await db.commit()
    result = await db.execute(
        select(Medicine)
        .options(
            selectinload(Medicine.manufacturer),
            selectinload(Medicine.base_unit),
            selectinload(Medicine.purchase_unit),
            selectinload(Medicine.sale_unit),
        )
        .where(Medicine.id == medicine_id)
    )
    return MedicineResponse.model_validate(result.scalar_one())


@router.delete("/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicine(
    medicine_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Delete medicine (soft delete - set inactive)."""
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise NotFoundError("Medicine", str(medicine_id))
    
    # Check if used in transactions
    from app.models import PurchaseInvoiceItem, SalesInvoiceItem, MedicineBatch
    for model in [PurchaseInvoiceItem, SalesInvoiceItem, MedicineBatch]:
        used_result = await db.execute(select(func.count(model.id)).where(model.medicine_id == medicine_id))
        if used_result.scalar() > 0:
            medicine.is_active = False
            await db.commit()
            return
    
    await db.delete(medicine)
    await db.commit()


@router.get("/{medicine_id}/batches")
async def get_medicine_batches(
    medicine_id: UUID,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Get batches for a medicine."""
    from app.models import MedicineBatch
    from app.models.enums import BatchStatus
    
    result = await db.execute(select(Medicine).where(Medicine.id == medicine_id))
    medicine = result.scalar_one_or_none()
    if not medicine:
        raise NotFoundError("Medicine", str(medicine_id))
    
    query = select(MedicineBatch).where(MedicineBatch.medicine_id == medicine_id)
    if status_filter:
        query = query.where(MedicineBatch.status == status_filter)
    query = query.order_by(MedicineBatch.expiry_date.asc())
    
    result = await db.execute(query)
    batches = result.scalars().all()
    
    return [
        {
            "id": str(b.id),
            "batch_number": b.batch_number,
            "manufacturing_date": b.manufacturing_date,
            "expiry_date": b.expiry_date,
            "supplier_id": str(b.supplier_id) if b.supplier_id else None,
            "received_quantity": float(b.received_quantity),
            "available_quantity": float(b.available_quantity),
            "purchase_cost_per_unit": float(b.purchase_cost_per_unit),
            "status": b.status,
            "location": b.location,
        }
        for b in batches
    ]
