import os
import hashlib
from fastapi import UploadFile
from typing import Tuple, Optional

from app.core.config import settings
from app.services.storage.base import IStorageService

CHUNK_SIZE = 1 * 1024 * 1024  # 1 Mo — bon compromis perf/RAM pour une V1


class LocalStorageService(IStorageService):
    def __init__(self):
        self.base_path = settings.STORAGE_PATH
        os.makedirs(self.base_path, exist_ok=True)

    async def save_file(self, file: UploadFile, directory: str = "") -> str:
        """Save file without returning checksum (backward compat). Delegates to save_file_with_checksum."""
        path, _ = await self.save_file_with_checksum(file, directory)
        return path

    async def save_file_with_checksum(
        self, file: UploadFile, directory: str = ""
    ) -> Tuple[str, str]:
        """
        Save file to local storage while computing SHA-256 in a single streaming pass.
        Never loads the full file into RAM — reads and writes by CHUNK_SIZE-sized chunks.

        Returns (relative_path, checksum_sha256_hex).
        The SHA-256 is the canonical fingerprint for binary duplicate detection.
        """
        target_dir = os.path.join(self.base_path, directory)
        os.makedirs(target_dir, exist_ok=True)

        filename = file.filename
        file_path = os.path.join(target_dir, filename)

        await file.seek(0)

        sha256 = hashlib.sha256()
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                sha256.update(chunk)
                buffer.write(chunk)

        relative_path = os.path.join(directory, filename).replace("\\", "/")
        return relative_path, sha256.hexdigest()

    def get_full_path(self, relative_path: str) -> str:
        return os.path.join(self.base_path, relative_path)

    def delete_file(self, relative_path: str) -> bool:
        full_path = self.get_full_path(relative_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
        return False

    def rename_file(self, old_relative_path: str, new_filename: str) -> Optional[str]:
        full_path = self.get_full_path(old_relative_path)
        if os.path.exists(full_path):
            directory = os.path.dirname(full_path)
            new_full_path = os.path.join(directory, new_filename)
            os.rename(full_path, new_full_path)

            import posixpath

            dir_relative = posixpath.dirname(old_relative_path)
            if dir_relative == old_relative_path:
                return new_filename
            return posixpath.join(dir_relative, new_filename)
        return None

    def get_file_content(self, relative_path: str) -> bytes:
        full_path = self.get_full_path(relative_path)
        if os.path.exists(full_path):
            with open(full_path, "rb") as f:
                return f.read()
        return b""
