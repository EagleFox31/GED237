from app.core.config import settings
from app.services.storage.base import IStorageService


def get_storage_service() -> IStorageService:
    """
    Factory function to get the configured storage service.
    """
    storage_type = getattr(settings, "STORAGE_TYPE", "local").lower()

    if storage_type == "s3" or storage_type == "minio":
        from app.services.storage.s3 import S3StorageService

        return S3StorageService()
    else:
        from app.services.storage.local import LocalStorageService

        return LocalStorageService()
