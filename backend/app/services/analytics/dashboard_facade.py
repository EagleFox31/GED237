from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.user import User
from app.models.document import Document
from app.models.workflow import WorkflowStep


class DashboardFacade:
    """
    Façade to aggregate statistics for Dashboards.
    Implements a simplified CQRS "Query" read-model separate from standard business CRUD.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tenant_metrics(self, tenant_id: str) -> Dict[str, Any]:
        """
        Get KPIs for a specific tenant (ministry).
        """
        # 1. User Statistics
        stmt_users = select(func.count(User.id)).where(User.tenant_id == tenant_id)
        users_count = await self.db.scalar(stmt_users) or 0

        # 2. Document & Storage Statistics
        stmt_docs = select(
            func.count(Document.id).label("total_docs"),
            func.sum(Document.file_size).label("total_storage_bytes"),
        ).where(Document.tenant_id == tenant_id)

        doc_res = (await self.db.execute(stmt_docs)).first()
        docs_count = doc_res.total_docs if doc_res else 0
        storage_bytes = (
            doc_res.total_storage_bytes
            if doc_res and doc_res.total_storage_bytes
            else 0
        )

        # 3. Workflows Statistics — join through Document to filter by tenant
        stmt_workflows = (
            select(
                func.count(WorkflowStep.id)
                .filter(WorkflowStep.status == "current")
                .label("pending"),
                func.count(WorkflowStep.id)
                .filter(WorkflowStep.status == "completed")
                .label("completed"),
                func.count(WorkflowStep.id)
                .filter(WorkflowStep.status == "rejected")
                .label("rejected"),
            )
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(Document.tenant_id == tenant_id)
        )

        wf_res = (await self.db.execute(stmt_workflows)).first()

        # 4. Storage format in MB for UI convenience
        storage_mb = round(storage_bytes / (1024 * 1024), 2)

        return {
            "users": {"total": users_count},
            "documents": {
                "total": docs_count,
                "storage_used_mb": storage_mb,
                "storage_quota_mb": settings.DEFAULT_TENANT_STORAGE_QUOTA_MB,
            },
            "workflows": {
                "pending": wf_res.pending if wf_res else 0,
                "completed": wf_res.completed if wf_res else 0,
                "rejected": wf_res.rejected if wf_res else 0,
            },
        }

    async def get_manager_metrics(
        self, tenant_id: str, org_unit_id: str
    ) -> Dict[str, Any]:
        """
        Get KPIs for a specific manager's scope (org unit).
        """
        # 1. Documents in this org unit
        stmt_docs = select(
            func.count(Document.id).label("total_docs"),
            func.sum(Document.file_size).label("total_storage_bytes"),
            func.count(Document.id)
            .filter(Document.classification_status.in_(("pending", "needs_review")))
            .label("needs_review"),
        ).where(
            Document.tenant_id == tenant_id,
            Document.org_unit_id == org_unit_id,
            Document.deleted_at.is_(None),
        )
        doc_res = (await self.db.execute(stmt_docs)).first()

        docs_count = doc_res.total_docs if doc_res else 0
        storage_bytes = (
            doc_res.total_storage_bytes
            if doc_res and doc_res.total_storage_bytes
            else 0
        )
        needs_review = doc_res.needs_review if doc_res else 0

        # 2. Workflow activity in this unit
        stmt_wf = (
            select(
                func.count(WorkflowStep.id)
                .filter(WorkflowStep.status == "current")
                .label("active_workflows")
            )
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(Document.org_unit_id == org_unit_id, Document.deleted_at.is_(None))
        )
        wf_res = (await self.db.execute(stmt_wf)).first()

        return {
            "org_unit_id": org_unit_id,
            "documents": {
                "total": docs_count,
                "storage_used_mb": round(storage_bytes / (1024 * 1024), 2),
                "needs_review": needs_review,
            },
            "active_workflows": wf_res.active_workflows if wf_res else 0,
        }

    async def get_platform_metrics(self) -> Dict[str, Any]:
        """
        Get global KPIs for the Super Admin platform dashboard across all tenants.
        """
        # We won't filter by tenant_id
        from app.models.tenant import Tenant

        # 1. Total Tenants
        tenants_count = await self.db.scalar(select(func.count(Tenant.id))) or 0

        # 2. Total Users Network-wide
        users_count = await self.db.scalar(select(func.count(User.id))) or 0

        # 3. Global Storage & Docs
        stmt_global_docs = select(
            func.count(Document.id).label("total_docs"),
            func.sum(Document.file_size).label("total_storage_bytes"),
        )
        global_doc_res = (await self.db.execute(stmt_global_docs)).first()

        total_docs = global_doc_res.total_docs if global_doc_res else 0
        total_storage_bytes = (
            global_doc_res.total_storage_bytes
            if global_doc_res and global_doc_res.total_storage_bytes
            else 0
        )
        storage_gb = round(total_storage_bytes / (1024 * 1024 * 1024), 2)

        return {
            "tenants": {"total": tenants_count},
            "users": {"total": users_count},
            "platform": {"total_documents": total_docs, "total_storage_gb": storage_gb},
        }
