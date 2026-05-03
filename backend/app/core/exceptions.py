from fastapi import HTTPException, status


class EDossierException(Exception):
    """Base exception for E-Dossier application"""

    def __init__(
        self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationError(EDossierException):
    """Authentication failed"""

    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class AuthorizationError(EDossierException):
    """User not authorized for this action"""

    def __init__(self, message: str = "Not authorized"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)


class NotFoundError(EDossierException):
    """Resource not found"""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status.HTTP_404_NOT_FOUND)


class ValidationError(EDossierException):
    """Validation error"""

    def __init__(self, message: str = "Validation failed"):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY)


class TenantIsolationError(EDossierException):
    """Tenant isolation violation"""

    def __init__(self, message: str = "Tenant isolation violation"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)
