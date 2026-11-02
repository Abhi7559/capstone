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
        code = exc.code or error_title.upper().replace(" ", "_")
        err_details = exc.error_details if exc.error_details is not None else {"reason": str(detail_msg)}

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": str(detail_msg),
                "detail": detail_msg,
                "error": {
                    "code": code,
                    "details": err_details,
                },
            },
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        clean_errors = []
        for err in exc.errors():
            cleaned = dict(err)
            if "ctx" in cleaned and isinstance(cleaned["ctx"], dict):
                cleaned["ctx"] = {k: str(v) for k, v in cleaned["ctx"].items()}
            clean_errors.append(cleaned)

        first_err_msg = clean_errors[0].get("msg", "Validation error") if clean_errors else "Validation error"

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "message": first_err_msg,
                "detail": clean_errors,
                "error": {
                    "code": "REQUEST_VALIDATION_ERROR",
                    "details": {"validation_errors": clean_errors},
                },
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        try:
            error_title = http.HTTPStatus(exc.status_code).phrase
        except ValueError:
            error_title = "Error"
        code = error_title.upper().replace(" ", "_")

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "message": str(exc.detail),
                "detail": exc.detail,
                "error": {
                    "code": code,
                    "details": {"reason": str(exc.detail)},
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
                "success": False,
                "message": "An unexpected server error occurred. Please try again later.",
                "detail": "An unexpected server error occurred. Please try again later.",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "details": {"reason": "Internal server error"},
                },
            },
        )

