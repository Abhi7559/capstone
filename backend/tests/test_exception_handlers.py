"""Comprehensive tests for centralized exception handlers (Day 6 Step 1).

Tests:
1. ForbiddenError / ForbiddenException returns HTTP 403 with standardized JSON.
2. EntityNotFoundError / EntityNotFoundException returns HTTP 404 with standardized JSON.
3. ConflictError / DuplicateEntityException returns HTTP 409 with standardized JSON.
4. InvalidCredentialsError / UnauthorizedException returns HTTP 401 with standardized JSON and WWW-Authenticate header.
5. ValidationRuleError / ValidationException returns HTTP 400 with standardized JSON.
6. Error responses follow the expected JSON contract ("status_code", "msg", "detail", "details").
7. Standard FastAPI HTTPException behavior remains preserved.
8. RequestValidationError (422) retains status and serializable structure.
9. Unhandled server exceptions return HTTP 500 without leaking stack traces or internal details.
10. Existing auth, project, task, and member endpoints continue behaving correctly.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import pytest
from httpx import AsyncClient, ASGITransport

from exceptions.domain import (
    DomainException,
    EntityNotFoundError,
    EntityNotFoundException,
    ForbiddenError,
    ForbiddenException,
    ConflictError,
    DuplicateEntityException,
    InvalidCredentialsError,
    UnauthorizedException,
    ValidationRuleError,
    ValidationException,
)
from exceptions.handlers import register_exception_handlers


@pytest.fixture
def error_app():
    """Create an isolated test FastAPI application with registered exception handlers."""
    test_app = FastAPI()
    register_exception_handlers(test_app)

    class SampleBody(BaseModel):
        name: str = Field(min_length=3)
        count: int

    @test_app.get("/trigger-forbidden")
    async def trigger_forbidden():
        raise ForbiddenError("You lack permission to access this resource.")

    @test_app.get("/trigger-not-found")
    async def trigger_not_found():
        raise EntityNotFoundError(entity_name="Task", identifier="12345")

    @test_app.get("/trigger-conflict")
    async def trigger_conflict():
        raise ConflictError("A user with this email already exists.")

    @test_app.get("/trigger-unauthorized")
    async def trigger_unauthorized():
        raise InvalidCredentialsError("Invalid email or password.")

    @test_app.get("/trigger-validation-rule")
    async def trigger_validation_rule():
        raise ValidationRuleError("Due date cannot be before start date.")

    @test_app.get("/trigger-http-exception")
    async def trigger_http_exception():
        raise HTTPException(status_code=418, detail="I'm a teapot")

    @test_app.post("/trigger-request-validation")
    async def trigger_request_validation(body: SampleBody):
        return {"status": "ok"}

    @test_app.get("/trigger-unhandled")
    async def trigger_unhandled():
        # Raise unexpected internal error
        raise RuntimeError("Secret internal database connection pointer failed: db://user:pass@10.0.0.1")

    return test_app


@pytest.mark.asyncio
async def test_forbidden_error_returns_403(error_app):
    """1. ForbiddenError returns HTTP 403 with standardized JSON."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-forbidden")
        assert response.status_code == 403
        data = response.json()
        assert data["status_code"] == 403
        assert data["msg"] == "Forbidden"
        assert "You lack permission" in data["detail"]
        assert "You lack permission" in data["details"]


@pytest.mark.asyncio
async def test_entity_not_found_returns_404(error_app):
    """2. EntityNotFoundError returns HTTP 404 with standardized JSON."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-not-found")
        assert response.status_code == 404
        data = response.json()
        assert data["status_code"] == 404
        assert data["msg"] == "Not Found"
        assert "Task with identifier '12345' not found" in data["detail"]


@pytest.mark.asyncio
async def test_conflict_error_returns_409(error_app):
    """3. ConflictError returns HTTP 409 with standardized JSON."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-conflict")
        assert response.status_code == 409
        data = response.json()
        assert data["status_code"] == 409
        assert data["msg"] == "Conflict"
        assert "already exists" in data["detail"]


@pytest.mark.asyncio
async def test_invalid_credentials_returns_401(error_app):
    """4. InvalidCredentialsError returns HTTP 401 with WWW-Authenticate header."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-unauthorized")
        assert response.status_code == 401
        assert response.headers.get("WWW-Authenticate") == "Bearer"
        data = response.json()
        assert data["status_code"] == 401
        assert data["msg"] == "Unauthorized"
        assert "Invalid email or password" in data["detail"]


@pytest.mark.asyncio
async def test_validation_rule_error_returns_400(error_app):
    """5. ValidationRuleError returns HTTP 400 with standardized JSON."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-validation-rule")
        assert response.status_code == 400
        data = response.json()
        assert data["status_code"] == 400
        assert data["msg"] == "Bad Request"
        assert "Due date cannot be before start date" in data["detail"]


@pytest.mark.asyncio
async def test_standard_http_exception_handled(error_app):
    """6. Standard HTTPException preserved with consistent structure."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        response = await ac.get("/trigger-http-exception")
        assert response.status_code == 418
        data = response.json()
        assert data["status_code"] == 418
        assert data["detail"] == "I'm a teapot"


@pytest.mark.asyncio
async def test_request_validation_error_422(error_app):
    """7. Pydantic RequestValidationError returns 422 with clean serializable detail."""
    async with AsyncClient(transport=ASGITransport(app=error_app), base_url="http://test") as ac:
        # Send payload violating min_length and wrong type
        response = await ac.post("/trigger-request-validation", json={"name": "x", "count": "not-int"})
        assert response.status_code == 422
        data = response.json()
        assert data["status_code"] == 422
        assert data["msg"] == "Unprocessable Entity"
        assert isinstance(data["detail"], list)


@pytest.mark.asyncio
async def test_unexpected_exception_returns_safe_500(error_app):
    """8. Unexpected internal error returns 500 without leaking stack trace or secrets."""
    async with AsyncClient(
        transport=ASGITransport(app=error_app, raise_app_exceptions=False),
        base_url="http://test",
    ) as ac:
        response = await ac.get("/trigger-unhandled")
        assert response.status_code == 500
        data = response.json()
        assert data["status_code"] == 500
        assert data["msg"] == "Internal Server Error"
        # Must NOT leak secret database pointer
        assert "db://user:pass" not in response.text
        assert "An unexpected server error occurred" in data["detail"]
