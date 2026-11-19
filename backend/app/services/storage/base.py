import os
import uuid
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
        self, file: UploadFile, directory: str = "", max_bytes: int | None = None
    ) -> Tuple[str, str]:
        """
        Save an upload file to storage while computing its SHA-256 in a single pass.
        Returns a tuple (relative_path, checksum_sha256).
        Enforces ``max_bytes`` (default settings.MAX_UPLOAD_SIZE) while streaming:
        raises app.core.errors.FileTooLargeError and leaves no partial file behind.
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


# Filesystems cap a file name at 255 bytes; local storage also writes "<name>.part".
_MAX_STORED_NAME_BYTES = 240


def unique_storage_name(filename: str | None) -> str:
    """Stored name of an upload: ``<uuid>_<name>``, the import pattern.

    A key derived from the bare file name made two uploads with the same name in
    the same directory overwrite each other (other documents, previous versions).
    A long name is cut (extension kept) so the whole key stays within the
    filesystem limit, counted in UTF-8 bytes.
    """
    prefix = f"{uuid.uuid4().hex}_"
    name = filename or "document"
    room = _MAX_STORED_NAME_BYTES - len(prefix.encode("utf-8"))
    if len(name.encode("utf-8")) > room:
        stem, ext = os.path.splitext(name)
        if len(ext.encode("utf-8")) > 16:  # not a real extension: cut it too
            stem, ext = name, ""
        budget = room - len(ext.encode("utf-8"))
        stem = stem.encode("utf-8")[:budget].decode("utf-8", errors="ignore")
        name = stem + ext
    return prefix + name
