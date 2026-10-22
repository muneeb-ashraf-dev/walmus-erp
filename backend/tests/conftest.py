"""Pytest configuration and fixtures."""
import os
import pytest
import pytest_asyncio
import sqlalchemy as sa
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models import *

# Test database URL - uses environment variable or default
TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/pharma_erp_test"
)


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Drop all tables after tests
    async with engine.begin() as conn:
        # Drop all tables with CASCADE to handle views
        await conn.execute(sa.text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
                END LOOP;
            END $$;
        """))
    
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    """Create a database session for each test with automatic cleanup."""
    async_session = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )
    
    async with async_session() as session:
        # Truncate all tables before each test to ensure clean state
        await session.execute(sa.text("""
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
                END LOOP;
            END $$;
        """))
        await session.commit()
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Create test client with database override."""
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    
    app.dependency_overrides.clear()


@pytest.fixture
def sample_medicine_data():
    """Sample medicine data for testing."""
    return {
        "product_code": "TEST001",
        "name": "Test Medicine",
        "generic_name": "Test Generic",
        "strength": "100mg",
        "dosage_form": "Tablet",
        "packing_description": "10x10 Tablets",
        "base_unit_id": None,  # Will be set in tests
        "units_per_pack": 100,
        "purchase_unit_id": None,
        "purchase_conversion_factor": 1.0,
        "sale_unit_id": None,
        "sale_conversion_factor": 1.0,
        "default_purchase_rate": 100.0,
        "default_sale_rate": 150.0,
        "tax_rate": 0.0,
        "reorder_level": 10,
        "min_stock_qty": 5,
        "is_active": True,
    }


@pytest.fixture
def sample_supplier_data():
    """Sample supplier data for testing."""
    return {
        "name": "Test Supplier",
        "contact_person": "John Doe",
        "phone": "1234567890",
        "email": "supplier@test.com",
        "address": "123 Test Street",
        "credit_limit": 100000.0,
        "payment_terms_days": 30,
        "opening_balance": 0.0,
    }


@pytest.fixture
def sample_customer_data():
    """Sample customer data for testing."""
    return {
        "name": "Test Customer",
        "contact_person": "Jane Smith",
        "phone": "0987654321",
        "email": "customer@test.com",
        "address": "456 Customer Ave",
        "customer_type": "pharmacy",
        "credit_limit": 50000.0,
        "payment_terms_days": 30,
        "opening_balance": 0.0,
    }