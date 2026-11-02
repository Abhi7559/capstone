from typing import Any, Optional, Dict
from fastapi import HTTPException, status


class DomainException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        msg: Optional[str] = None,
        details: Any = None,
        detail: Any = None,
        code: Optional[str] = None,
        error_details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.msg = msg or (status.HTTP_STATUS_PHRASES.get(status_code, "Error"))
        self.details = details if details is not None else detail
        self.code = code
        self.error_details = error_details
        super().__init__(status_code=status_code, detail=self.details or self.msg, headers=headers)


class EntityNotFoundException(DomainException):
    def __init__(self, entity_name: str, identifier: Any):
        clean_name = entity_name.strip()
        code = f"{clean_name.upper().replace(' ', '_')}_NOT_FOUND"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            msg=f"{clean_name} not found",
            details=f"{clean_name} with identifier '{identifier}' not found.",
            code=code,
            error_details={"entity": clean_name, "identifier": str(identifier)},
        )


class DuplicateEntityException(DomainException):
    def __init__(self, message: str, code: str = "DUPLICATE_ENTITY"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            msg="Conflict",
            details=message,
            code=code,
            error_details=None,
        )


class UnauthorizedException(DomainException):
    def __init__(self, detail: str = "Could not validate credentials", msg: str = "Unauthorized", code: str = "UNAUTHORIZED"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            msg=msg,
            details=detail,
            code=code,
            error_details=None,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(DomainException):
    def __init__(self, detail: str = "Insufficient permissions", msg: str = "Forbidden", code: str = "FORBIDDEN"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            msg=msg,
            details=detail,
            code=code,
            error_details=None,
        )


class ValidationException(DomainException):
    def __init__(self, detail: str = "Validation error", msg: str = "Bad Request", code: str = "VALIDATION_ERROR"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            msg=msg,
            details=detail,
            code=code,
            error_details=None,
        )


# Backward-compatible and blueprint-friendly aliases
InvalidTokenError = UnauthorizedException
InvalidCredentialsError = UnauthorizedException
ForbiddenError = ForbiddenException
ValidationError = ValidationException
ValidationRuleError = ValidationException
EntityNotFoundError = EntityNotFoundException
ConflictError = DuplicateEntityException
ConflictException = DuplicateEntityException

