from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from redis.asyncio import Redis

from core.config import settings
from core.logger import logger
from exceptions.handlers import register_exception_handlers
from dependencies.db import get_db
from schemas.health_schema import HealthResponse, ServiceStatus
from routes.auth import router as auth_router
from routes.members import router as members_router
from routes.projects import router as projects_router
from routes.tasks import router as tasks_router
from routes.dashboard import router as dashboard_router
from routes.analytics import router as analytics_router
from routes.htmx_dashboard import router as htmx_router

openapi_tags = [
    {
        "name": "Health",
        "description": "System health and availability monitoring endpoints.",
    },
    {
        "name": "Authentication",
        "description": "User login, password rotation, and token management.",
    },
    {
        "name": "Members",
        "description": "Team member directory and onboarding invitation workflows.",
    },
    {
        "name": "Projects",
        "description": "Project lifecycle management and member assignments.",
    },
    {
        "name": "Tasks",
        "description": "Task tracking, status transitions, and Kanban boards.",
    },
    {
        "name": "Dashboard",
        "description": "Role-tailored overview KPIs and metrics.",
    },
    {
        "name": "Analytics",
        "description": "Project progress metrics and velocity data.",
    },
    {
        "name": "HTMX",
        "description": "Server-rendered HTML components via Jinja2 & HTMX.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    logger.info("==================================================")
    logger.info(" Starting %s v%s", settings.PROJECT_NAME, settings.VERSION)
    logger.info(" Environment : %s", settings.ENVIRONMENT)
    logger.info(" API Prefix  : %s", settings.API_V1_PREFIX)
    logger.info(" Database URL: %s", settings.DATABASE_URL.split("@")[-1])
    logger.info("==================================================")
    
    # Initialize asynchronous Redis connection pool
    try:
        from database.redis import init_redis, close_redis
        await init_redis()
    except Exception as exc:
        logger.warning("Could not initialize Redis at startup: %s", exc)

    yield

    logger.info("==================================================")
    logger.info(" Shutting down %s...", settings.PROJECT_NAME)
    try:
        from database.redis import close_redis
        await close_redis()
    except Exception as exc:
        logger.warning("Could not close Redis at shutdown: %s", exc)
    logger.info(" Lifecycle cleanup completed successfully.")
    logger.info("==================================================")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    openapi_tags=openapi_tags,
    lifespan=lifespan,
)

# CORS Middleware
cors_origins = list(settings.BACKEND_CORS_ORIGINS) if settings.BACKEND_CORS_ORIGINS else ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register centralized exception handlers
register_exception_handlers(app)

from time import perf_counter
from fastapi import Request
from fastapi.responses import Response
from core.logger import set_request_id


# 1. Response-Time Middleware: Measures total duration in milliseconds
@app.middleware("http")
async def response_time_middleware(request: Request, call_next) -> Response:
    """
    Measures the total processing time of each request and appends it
    to the response as 'X-Process-Time-Ms' in milliseconds.
    """
    start_time = perf_counter()
    response = await call_next(request)
    duration_ms = (perf_counter() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
    return response


# 2. Request-ID & Logging Middleware
@app.middleware("http")
async def request_id_logging_middleware(request: Request, call_next) -> Response:
    """
    Middleware that generates/extracts a unique identifier per request,
    attaches it to logger context (so every log entry carries it end-to-end),
    and injects X-Request-ID and X-Trace-ID headers in the response.
    """
    import uuid

    header_id = request.headers.get("X-Request-ID") or request.headers.get("X-Trace-ID")
    req_id = header_id.strip() if header_id and header_id.strip() else str(uuid.uuid4())
    set_request_id(req_id)

    response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Trace-ID"] = req_id
    return response


@app.get("/", include_in_schema=False)
async def root():
    """Redirect root to interactive Swagger UI API documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


# ============================================================================
# Single Health Check Endpoint (API 23: Service Health)
# ============================================================================
@app.get(
    f"{settings.API_V1_PREFIX}/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    tags=["Health"],
    summary="Service Health",
    description="Checks PostgreSQL and Redis connectivity for operational monitoring.",
    responses={
        200: {
            "description": "All required services are healthy and connected.",
            "model": HealthResponse,
        },
        503: {
            "description": "Service unavailable: one or more required dependencies are disconnected.",
            "model": HealthResponse,
        },
    },
)
async def check_service_health(db: AsyncSession = Depends(get_db)):
    """
    Checks PostgreSQL and Redis connectivity.
    Returns 200 OK if both connected, or 503 Service Unavailable if any service fails.
    """
    db_status = "connected"
    redis_status = "connected"

    # 1. Check PostgreSQL Database Connectivity
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() != 1:
            db_status = "disconnected"
    except Exception as exc:
        logger.warning("Database health check failed: %s", exc)
        db_status = "disconnected"

    # 2. Check Redis Connectivity
    try:
        redis_client = Redis.from_url(
            settings.REDIS_URL,
            socket_connect_timeout=2.0,
            socket_timeout=2.0,
        )
        await redis_client.ping()
        await redis_client.aclose()
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)
        redis_status = "disconnected"

    is_healthy = (db_status == "connected") and (redis_status == "connected")
    overall_status = "healthy" if is_healthy else "unhealthy"

    response_payload = {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": db_status,
            "redis": redis_status,
        },
    }

    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=http_status, content=response_payload)


# Mount Authentication Router under versioned prefix
app.include_router(
    auth_router, prefix=f"{settings.API_V1_PREFIX}/auth", tags=["Authentication"]
)

# Mount Members Router under versioned prefix
app.include_router(
    members_router, prefix=f"{settings.API_V1_PREFIX}/members", tags=["Members"]
)

# Mount Projects Router under versioned prefix
app.include_router(
    projects_router, prefix=f"{settings.API_V1_PREFIX}/projects", tags=["Projects"]
)

# Mount Tasks Router under versioned prefix
app.include_router(
    tasks_router, prefix=f"{settings.API_V1_PREFIX}/tasks", tags=["Tasks"]
)

# Mount Dashboard Router under versioned prefix
app.include_router(
    dashboard_router, prefix=f"{settings.API_V1_PREFIX}/dashboard", tags=["Dashboard"]
)

# Mount Analytics Router under versioned prefix
app.include_router(
    analytics_router, prefix=f"{settings.API_V1_PREFIX}/analytics", tags=["Analytics"]
)

# Mount HTMX Server-Rendered Components
app.include_router(
    htmx_router, prefix="/htmx", tags=["HTMX"]
)

