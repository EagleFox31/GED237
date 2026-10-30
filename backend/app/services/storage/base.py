from abc import ABC, abstractmethod
from fastapi import UploadFile
from typing import Optional, Tuple


class IStorageService(ABC):
    @abstractmethod
    async def save_file(self, file: UploadFile, directory: str = "") -> str:
        """
        Save an upload file to storage.
        Returns the relative path or object key.
        """
        pass

    @abstractmethod
    async def save_file_with_checksum(
        self, file: UploadFile, directory: str = ""
    ) -> Tuple[str, str]:
        """
        Save an upload file to storage while computing its SHA-256 in a single pass.
        Returns a tuple (relative_path, checksum_sha256).
        Never reads the full file into memory — uses chunked streaming.
        """
        pass

    @abstractmethod
    def get_full_path(self, relative_path: str) -> str:
        """
        Get the full URI or local absolute path of a stored file.
        """
        pass

    @abstractmethod
    def delete_file(self, relative_path: str) -> bool:
        """
        Delete a file from storage.
        Returns True if successful.
        """
        pass

    @abstractmethod
    def rename_file(self, old_relative_path: str, new_filename: str) -> Optional[str]:
        """
        Rename a file in storage (in the same directory).
        Returns the new relative path if successful, None otherwise.
        """
        pass

    @abstractmethod
    def copy_file(self, source_relative_path: str, target_relative_path: str) -> bool:
        """
        Copy a stored file to another relative path in the same backend.
        Returns True if successful.
        """
        pass

    @abstractmethod
    def get_file_content(self, relative_path: str) -> bytes:
        """
        Read the entire file content into memory.
        """
        pass
