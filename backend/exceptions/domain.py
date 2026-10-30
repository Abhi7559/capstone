from typing import Any, Optional, Dict
from fastapi import HTTPException, status


class DomainException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        msg: Optional[str] = None,
        details: Any = None,
        detail: Any = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        # Resolve message and details:
        # If msg is not provided, derive from HTTP status reason or detail
        self.status_code = status_code
        self.msg = msg or (status.HTTP_STATUS_PHRASES.get(status_code, "Error"))
        self.details = details if details is not None else detail
        super().__init__(status_code=status_code, detail=self.details or self.msg, headers=headers)


class EntityNotFoundException(DomainException):
    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            msg="Not Found",
            details=f"{entity_name} with identifier '{identifier}' not found.",
        )


class DuplicateEntityException(DomainException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            msg="Conflict",
            details=message,
        )


class UnauthorizedException(DomainException):
    def __init__(self, detail: str = "Could not validate credentials", msg: str = "Unauthorized"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            msg=msg,
            details=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(DomainException):
    def __init__(self, detail: str = "Insufficient permissions", msg: str = "Forbidden"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            msg=msg,
            details=detail,
        )


class ValidationException(DomainException):
    def __init__(self, detail: str = "Validation error", msg: str = "Bad Request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            msg=msg,
            details=detail,
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

