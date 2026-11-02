import traceback
import http
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
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "error": error_title,
                "detail": detail_msg,
            },
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        # Extract errors and ensure any context/exceptions are string-serializable
        clean_errors = []
        for err in exc.errors():
            cleaned = dict(err)
            if "ctx" in cleaned and isinstance(cleaned["ctx"], dict):
                cleaned["ctx"] = {k: str(v) for k, v in cleaned["ctx"].items()}
            clean_errors.append(cleaned)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
                "error": "Unprocessable Entity",
                "detail": clean_errors,
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        try:
            error_title = http.HTTPStatus(exc.status_code).phrase
        except ValueError:
            error_title = "Error"

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status_code": exc.status_code,
                "error": error_title,
                "detail": exc.detail,
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
                "error": "Internal Server Error",
                "detail": "An unexpected server error occurred. Please try again later.",
            },
        )

