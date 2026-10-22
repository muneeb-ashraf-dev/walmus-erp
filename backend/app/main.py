"""Main FastAPI application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db, close_db
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import register_exception_handlers
from app.api import auth, dashboard, medicines, suppliers, customers, purchases, sales, inventory, financial, reports, settings as settings_api, import_export

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    setup_logging(settings.log_level, settings.log_format)
    logger.info("Starting Walmus Pharma ERP Backend")
    
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Walmus Pharma ERP Backend")
    await close_db()


app = FastAPI(
    title="Walmus Pharma ERP API",
    description="Pharmaceutical ERP and Inventory Management System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "pharma-erp-backend"}

# API Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(medicines.router, prefix="/api/medicines", tags=["Medicines"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(purchases.router, prefix="/api/purchases", tags=["Purchases"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(financial.router, prefix="/api/financial", tags=["Financial"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(settings_api.router, prefix="/api/settings", tags=["Settings"])
app.include_router(import_export.router, prefix="/api/import-export", tags=["Import & Export"])

# Global exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.exception("Unhandled exception", path=request.url.path, error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.backend_host,
        port=settings.backend_port,
        reload=True,
    )