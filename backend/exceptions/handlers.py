import traceback
import http
from typing import Dict, Any, Optional
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from core.logger import logger
from exceptions.domain import DomainException


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        detail_msg = exc.details if exc.details is not None else exc.msg
        error_title = exc.msg or status.HTTP_STATUS_PHRASES.get(exc.status_code, "Error")
        code = exc.code or error_title.upper().replace(" ", "_")

        error_obj: Dict[str, Any] = {"code": code}
        if exc.error_details:
            error_obj["details"] = exc.error_details

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "success": False,
                "message": error_title,
                "detail": detail_msg,
                "error": error_obj,
            },
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        clean_errors = []
        fields = []
        for err in exc.errors():
            cleaned = dict(err)
            if "ctx" in cleaned and isinstance(cleaned["ctx"], dict):
                cleaned["ctx"] = {k: str(v) for k, v in cleaned["ctx"].items()}
            clean_errors.append(cleaned)
            loc = cleaned.get("loc", [])
            if len(loc) > 1:
                fields.append(str(loc[-1]))

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "success": False,
                "message": "Validation Error",
                "detail": clean_errors,
                "error": {
                    "code": "REQUEST_VALIDATION_ERROR",
                    "details": {"invalid_fields": fields} if fields else {"errors_count": len(clean_errors)},
                },
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        try:
            phrase = http.HTTPStatus(exc.status_code).phrase
        except ValueError:
            phrase = "Error"
        code = phrase.upper().replace(" ", "_")

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "success": False,
                "message": phrase,
                "detail": exc.detail,
                "error": {
                    "code": code,
                },
            },
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Unhandled exception processing request %s %s: %s",
            request.method,
            request.url.path,
            exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "success": False,
                "message": "Internal Server Error",
                "detail": "An unexpected server error occurred. Please try again later.",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                },
            },
        )

