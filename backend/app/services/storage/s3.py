import os
import hashlib
import tempfile
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile

from app.core.config import settings
from app.services.storage.base import IStorageService


class S3StorageService(IStorageService):
    def __init__(self):
        # We assume settings has S3_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME
        self.bucket_name = getattr(settings, "S3_BUCKET_NAME", "ged237-documents")
        self.endpoint_url = getattr(settings, "S3_ENDPOINT_URL", None)
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=getattr(settings, "S3_ACCESS_KEY", "minioadmin"),
            aws_secret_access_key=getattr(settings, "S3_SECRET_KEY", "minioadmin"),
            region_name=getattr(settings, "S3_REGION", "us-east-1"),
        )
        # Create bucket if it doesn't exist
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except ClientError:
            self.s3_client.create_bucket(Bucket=self.bucket_name)

    async def save_file(self, file: UploadFile, directory: str = "") -> str:
        filename = file.filename
        object_name = f"{directory}/{filename}" if directory else filename
        object_name = object_name.replace("\\", "/")

        # Rewind if already read
        await file.seek(0)
        self.s3_client.upload_fileobj(file.file, self.bucket_name, object_name)

        return object_name

    async def save_file_with_checksum(self, file: UploadFile, directory: str = ""):
        filename = file.filename
        object_name = f"{directory}/{filename}" if directory else filename
        object_name = object_name.replace("\\", "/")

        await file.seek(0)
        sha256 = hashlib.sha256()
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                sha256.update(chunk)
                tmp.write(chunk)

        try:
            self.s3_client.upload_file(tmp_path, self.bucket_name, object_name)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            await file.seek(0)

        return object_name, sha256.hexdigest()

    def get_full_path(self, relative_path: str) -> str:
        """
        For S3, this could return a presigned URL, or just the S3 URI.
        """
        # Alternatively return presigned URL
        return f"s3://{self.bucket_name}/{relative_path}"

    def delete_file(self, relative_path: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=relative_path)
            return True
        except ClientError:
            return False

    def rename_file(self, old_relative_path: str, new_filename: str):
        directory = os.path.dirname(old_relative_path).replace("\\", "/")
        new_relative_path = f"{directory}/{new_filename}" if directory else new_filename
        new_relative_path = new_relative_path.replace("\\", "/")
        try:
            self.s3_client.copy_object(
                Bucket=self.bucket_name,
                CopySource={"Bucket": self.bucket_name, "Key": old_relative_path},
                Key=new_relative_path,
            )
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=old_relative_path)
            return new_relative_path
        except ClientError:
            return None

    def copy_file(self, source_relative_path: str, target_relative_path: str) -> bool:
        try:
            self.s3_client.copy_object(
                Bucket=self.bucket_name,
                CopySource={"Bucket": self.bucket_name, "Key": source_relative_path},
                Key=target_relative_path,
            )
            return True
        except ClientError:
            return False

    def get_file_content(self, relative_path: str) -> bytes:
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name, Key=relative_path
            )
            return response["Body"].read()
        except ClientError:
            return b""
