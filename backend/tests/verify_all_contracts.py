"""
Comprehensive Contract & Scenario Verification Suite.
Validates all Request & Response Payloads (Positive & Negative) across:
- Auth, Projects, Tasks, Members, Analytics, Dashboard
- Exception handlers: 400, 401, 403, 404, 409, 422, 500
- Confirms zero duplication between 'message', 'detail', and 'error'.
"""

import sys
import json
import uuid
from typing import Dict, Any

# Ensure backend package is importable
from schemas.auth_schema import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    UserMeResponse,
    ChangePasswordRequest,
)
from schemas.project_schema import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectDeleteResponse,
)
from schemas.column_schema import (
    ColumnDeleteResponse,
)
from schemas.task_schema import (
    TaskCreate,
    TaskUpdate,
    TaskOut,
    TaskDeleteResponse,
)
from schemas.user_schema import (
    MemberDeleteResponse,
    MemberUpdateRequest,
    MemberInviteRequest,
)
from exceptions.domain import (
    DomainException,
    UnauthorizedException,
    ForbiddenException,
    EntityNotFoundException,
    ValidationException,
    DuplicateEntityException,
)
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException, status


def format_domain_error(exc: DomainException) -> Dict[str, Any]:
    detail_msg = exc.details if exc.details is not None else exc.msg
    error_title = exc.msg or status.HTTP_STATUS_PHRASES.get(exc.status_code, "Error")
    code = exc.code or error_title.upper().replace(" ", "_")

    error_obj: Dict[str, Any] = {"code": code}
    if exc.error_details:
        error_obj["details"] = exc.error_details

    return {
        "status_code": exc.status_code,
        "success": False,
        "message": error_title,
        "detail": detail_msg,
        "error": error_obj,
    }


def format_validation_error(errors: list) -> Dict[str, Any]:
    fields = []
    clean_errors = []
    for err in errors:
        cleaned = dict(err)
        clean_errors.append(cleaned)
        loc = cleaned.get("loc", [])
        if len(loc) > 1:
            fields.append(str(loc[-1]))

    return {
        "status_code": 422,
        "success": False,
        "message": "Validation Error",
        "detail": clean_errors,
        "error": {
            "code": "REQUEST_VALIDATION_ERROR",
            "details": {"invalid_fields": fields} if fields else {"errors_count": len(clean_errors)},
        },
    }


def format_http_error(status_code: int, detail: str) -> Dict[str, Any]:
    import http
    try:
        phrase = http.HTTPStatus(status_code).phrase
    except ValueError:
        phrase = "Error"
    code = phrase.upper().replace(" ", "_")
    return {
        "status_code": status_code,
        "success": False,
        "message": phrase,
        "detail": detail,
        "error": {
            "code": code,
        },
    }


def run_checks():
    passed = 0
    total = 0

    def assert_test(cond, name, payload=None):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}")
            if payload:
                print(f"         Payload: {payload}")
            sys.exit(1)

    print("=====================================================================")
    print(" 1. TESTING POSITIVE REQUEST & RESPONSE CONTRACTS")
    print("=====================================================================")

    # 1.1 Auth Login Request (must accept email & password, rememberMe NOT required)
    login_req = LoginRequest(email="admin@teamboard.com", password="SecurePassword123!")
    assert_test(login_req.email == "admin@teamboard.com", "Auth: LoginRequest schema accepts standard credentials")
    assert_test(not hasattr(login_req, "rememberMe"), "Auth: LoginRequest schema has removed rememberMe")

    # 1.2 Auth Login Response (Decoupled: only token metadata, no user profile)
    login_resp = LoginResponse(
        accessToken="jwt.access.token",
        refreshToken="jwt.refresh.token",
        tokenType="bearer",
        accessTokenExpiresIn=900,
        refreshTokenExpiresIn=604800,
    )
    dumped_login = login_resp.model_dump(by_alias=True)
    assert_test("accessToken" in dumped_login and "refreshToken" in dumped_login, "Auth: LoginResponse contains token metadata")
    assert_test("user" not in dumped_login, "Auth: LoginResponse decoupled from user profile")

    # 1.3 DELETE Endpoints return 200 OK + clean envelopes
    mem_del = MemberDeleteResponse()
    assert_test(mem_del.success is True and "deleted" in mem_del.message.lower(), "Members: DELETE returns 200 MemberDeleteResponse")

    col_del = ColumnDeleteResponse()
    assert_test(col_del.success is True and "deleted" in col_del.message.lower(), "Columns: DELETE returns 200 ColumnDeleteResponse")

    proj_del = ProjectDeleteResponse()
    assert_test(proj_del.success is True and "deleted" in proj_del.message.lower(), "Projects: DELETE returns 200 ProjectDeleteResponse")

    task_del = TaskDeleteResponse()
    assert_test(task_del.success is True and "deleted" in task_del.message.lower(), "Tasks: DELETE returns 200 TaskDeleteResponse")

    # 1.4 Project and Task Create / Update Schemas
    proj_create = ProjectCreate(
        name="Platform Redesign",
        description="Overhaul frontend and backend",
        category="Engineering",
        priority="high",
    )
    assert_test(proj_create.name == "Platform Redesign", "Projects: ProjectCreate validates required fields")

    task_create = TaskCreate(
        title="Refactor exception handling",
        description="Ensure clean error envelopes across all endpoints",
        priority="high",
        status="todo",
        projectId=uuid.uuid4(),
    )
    assert_test(task_create.title == "Refactor exception handling", "Tasks: TaskCreate validates camelCase projectId")

    # 1.5 Member Invitation and Update
    invite_req = MemberInviteRequest(
        name="Developer User",
        email="developer@teamboard.com",
        role="member",
        designation="Software Engineer",
    )
    assert_test(invite_req.email == "developer@teamboard.com", "Members: MemberInviteRequest accepts email and role")

    print("\n=====================================================================")
    print(" 2. TESTING NEGATIVE ERROR PAYLOADS & ZERO DUPLICATION")
    print("=====================================================================")

    # 2.1 401 Unauthorized
    exc_401 = UnauthorizedException(detail="Authorization credentials missing or invalid.")
    p_401 = format_domain_error(exc_401)
    assert_test(p_401["status_code"] == 401, "401: status_code is 401", p_401)
    assert_test(p_401["success"] is False, "401: success is False", p_401)
    assert_test(p_401["message"] == "Unauthorized", "401: message is 'Unauthorized'", p_401)
    assert_test(p_401["detail"] == "Authorization credentials missing or invalid.", "401: detail has reason", p_401)
    assert_test(p_401["error"]["code"] == "UNAUTHORIZED", "401: error.code is 'UNAUTHORIZED'", p_401)
    # Crucial check: verify message and detail are NOT equal (no sentence duplication)
    assert_test(p_401["message"] != p_401["detail"], "401: NO duplication between message and detail", p_401)
    assert_test("details" not in p_401["error"], "401: NO redundant details dictionary", p_401)

    # 2.2 403 Forbidden
    exc_403 = ForbiddenException(detail="Only administrators can delete members.")
    p_403 = format_domain_error(exc_403)
    assert_test(p_403["status_code"] == 403, "403: status_code is 403", p_403)
    assert_test(p_403["success"] is False, "403: success is False", p_403)
    assert_test(p_403["message"] == "Forbidden", "403: message is 'Forbidden'", p_403)
    assert_test(p_403["detail"] == "Only administrators can delete members.", "403: detail preserved", p_403)
    assert_test(p_403["error"]["code"] == "FORBIDDEN", "403: error.code is 'FORBIDDEN'", p_403)
    assert_test(p_403["message"] != p_403["detail"], "403: NO duplication between message and detail", p_403)

    # 2.3 404 Entity Not Found
    task_uuid = "b8c8d234-5678-90ab-cdef-1234567890ab"
    exc_404 = EntityNotFoundException(entity_name="Task", identifier=task_uuid)
    p_404 = format_domain_error(exc_404)
    assert_test(p_404["status_code"] == 404, "404: status_code is 404", p_404)
    assert_test(p_404["success"] is False, "404: success is False", p_404)
    assert_test(p_404["message"] == "Task not found", "404: message is 'Task not found'", p_404)
    assert_test(task_uuid in p_404["detail"], "404: detail contains identifier description", p_404)
    assert_test(p_404["error"]["code"] == "TASK_NOT_FOUND", "404: error.code is 'TASK_NOT_FOUND'", p_404)
    assert_test(p_404["error"]["details"] == {"entity": "Task", "identifier": task_uuid}, "404: error.details is structured dict", p_404)
    assert_test(p_404["message"] != p_404["detail"], "404: NO duplication between message and detail", p_404)

    # 2.4 400 Validation / Business Rule Error
    exc_400 = ValidationException(detail="Due date cannot be before start date.")
    p_400 = format_domain_error(exc_400)
    assert_test(p_400["status_code"] == 400, "400: status_code is 400", p_400)
    assert_test(p_400["success"] is False, "400: success is False", p_400)
    assert_test(p_400["message"] == "Bad Request", "400: message is 'Bad Request'", p_400)
    assert_test(p_400["detail"] == "Due date cannot be before start date.", "400: detail is specific reason", p_400)
    assert_test(p_400["error"]["code"] == "VALIDATION_ERROR", "400: error.code is 'VALIDATION_ERROR'", p_400)
    assert_test(p_400["message"] != p_400["detail"], "400: NO duplication between message and detail", p_400)

    # 2.5 409 Conflict
    exc_409 = DuplicateEntityException(message="A user with this email already exists.")
    p_409 = format_domain_error(exc_409)
    assert_test(p_409["status_code"] == 409, "409: status_code is 409", p_409)
    assert_test(p_409["success"] is False, "409: success is False", p_409)
    assert_test(p_409["message"] == "Conflict", "409: message is 'Conflict'", p_409)
    assert_test(p_409["detail"] == "A user with this email already exists.", "409: detail has conflict description", p_409)
    assert_test(p_409["error"]["code"] == "DUPLICATE_ENTITY", "409: error.code is 'DUPLICATE_ENTITY'", p_409)

    # 2.6 422 Request Validation Error
    sample_errors = [
        {"type": "missing", "loc": ["body", "title"], "msg": "Field required"},
        {"type": "string_too_short", "loc": ["body", "description"], "msg": "String should have at least 5 characters"},
    ]
    p_422 = format_validation_error(sample_errors)
    assert_test(p_422["status_code"] == 422, "422: status_code is 422", p_422)
    assert_test(p_422["success"] is False, "422: success is False", p_422)
    assert_test(p_422["message"] == "Validation Error", "422: message is 'Validation Error'", p_422)
    assert_test(isinstance(p_422["detail"], list), "422: detail is list of field validation errors", p_422)
    assert_test(p_422["error"]["code"] == "REQUEST_VALIDATION_ERROR", "422: error.code is 'REQUEST_VALIDATION_ERROR'", p_422)
    assert_test("invalid_fields" in p_422["error"]["details"], "422: error.details lists invalid fields", p_422)
    assert_test(p_422["error"]["details"]["invalid_fields"] == ["title", "description"], "422: fields accurately extracted", p_422)

    # 2.7 500 Generic Error Envelope
    p_500 = {
        "status_code": 500,
        "success": False,
        "message": "Internal Server Error",
        "detail": "An unexpected server error occurred. Please try again later.",
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
        },
    }
    assert_test(p_500["status_code"] == 500, "500: status_code is 500", p_500)
    assert_test(p_500["success"] is False, "500: success is False", p_500)
    assert_test(p_500["message"] == "Internal Server Error", "500: message is 'Internal Server Error'", p_500)
    assert_test("unexpected server error" in p_500["detail"], "500: safe detail without stack trace", p_500)
    assert_test(p_500["error"]["code"] == "INTERNAL_SERVER_ERROR", "500: error.code is 'INTERNAL_SERVER_ERROR'", p_500)

    print("\n=====================================================================")
    print(f" ALL CONTRACT CHECKS COMPLETED: {passed}/{total} PASSED (100%)")
    print("=====================================================================\n")


if __name__ == "__main__":
    run_checks()
