from datetime import date, datetime, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import String, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.classification_review import ClassificationReview
from app.models.document import Document
from app.models.local_organize_event import LocalOrganizeEvent
from app.models.org_unit import OrgUnit
from app.models.org_unit import OrgUnitClosure
from app.models.workflow import WorkflowStep
from app.schemas.reports import (
    ReportsDocumentActivityAvailability,
    ReportsDocumentActivityBreakdownItem,
    ReportsDocumentActivityResponse,
    ReportsDocumentActivitySignals,
    ReportsBreakdownItem,
    ReportsEvolutionBreakdowns,
    ReportsEvolutionFilters,
    ReportsEvolutionResponse,
    ReportsEvolutionSeries,
    ReportsSeriesBreakdowns,
    ReportsEvolutionTotals,
    ReportsGranularity,
    ReportsSeriesKey,
    ReportsTimeseriesPoint,
    ReportsWorkflowActivityAvailability,
    ReportsWorkflowActivityBreakdownItem,
    ReportsWorkflowActivityResponse,
    ReportsWorkflowDelayItem,
    ReportsServiceActivityItem,
    ReportsServiceActivityResponse,
)
from app.models.user import User


class ReportsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_evolution(
        self,
        *,
        tenant_id: UUID,
        date_from: Optional[date],
        date_to: Optional[date],
        granularity: ReportsGranularity,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> ReportsEvolutionResponse:
        effective_from, effective_to = self._normalize_dates(date_from, date_to)
        common_kwargs = {
            "tenant_id": tenant_id,
            "date_from": effective_from,
            "date_to": effective_to,
            "granularity": granularity,
            "org_unit_id": org_unit_id,
            "recursive": recursive,
            "domain_id": domain_id,
            "activity_id": activity_id,
            "document_category_id": document_category_id,
        }
        documents_created = await self._build_series(metric="documents_created", **common_kwargs)
        documents_auto_classified = await self._build_series(metric="documents_auto_classified", **common_kwargs)
        documents_needing_review = await self._build_series(metric="documents_needing_review", **common_kwargs)

        totals = ReportsEvolutionTotals(
            documents_created=sum(point.value for point in documents_created),
            documents_auto_classified=sum(point.value for point in documents_auto_classified),
            documents_needing_review=sum(point.value for point in documents_needing_review),
        )

        breakdown_kwargs = {
            "tenant_id": tenant_id,
            "date_from": effective_from,
            "date_to": effective_to,
            "org_unit_id": org_unit_id,
            "recursive": recursive,
            "domain_id": domain_id,
            "activity_id": activity_id,
            "document_category_id": document_category_id,
        }

        return ReportsEvolutionResponse(
            filters=ReportsEvolutionFilters(
                tenant_id=tenant_id,
                date_from=effective_from,
                date_to=effective_to,
                granularity=granularity,
                org_unit_id=org_unit_id,
                recursive=recursive,
                domain_id=domain_id,
                activity_id=activity_id,
                document_category_id=document_category_id,
            ),
            series=ReportsEvolutionSeries(
                documents_created=documents_created,
                documents_auto_classified=documents_auto_classified,
                documents_needing_review=documents_needing_review,
            ),
            totals=totals,
            breakdowns=ReportsEvolutionBreakdowns(
                org_units=ReportsSeriesBreakdowns(
                    documents_created=await self._top_org_units_for_metric(
                        metric="documents_created",
                        **breakdown_kwargs,
                    ),
                    documents_auto_classified=await self._top_org_units_for_metric(
                        metric="documents_auto_classified",
                        **breakdown_kwargs,
                    ),
                    documents_needing_review=await self._top_org_units_for_metric(
                        metric="documents_needing_review",
                        **breakdown_kwargs,
                    ),
                ),
            ),
        )

    async def get_document_activity(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> ReportsDocumentActivityResponse:
        common_filters = self._document_filters(
            metric="documents_created",
            tenant_id=tenant_id,
            date_from=None,
            date_to=None,
            org_unit_id=org_unit_id,
            recursive=recursive,
            domain_id=domain_id,
            activity_id=activity_id,
            document_category_id=document_category_id,
        )

        total_active_documents = await self._count_documents(common_filters)
        validated_documents = await self._count_documents(
            [*common_filters, Document.status.in_(("validated", "signed"))]
        )
        archived_documents = await self._count_documents(
            [*common_filters, Document.status == "archived"]
        )
        reviewed_documents = await self._count_documents(
            [*common_filters, Document.classification_status == "needs_review"]
        )

        by_status = await self._group_documents_by_status(common_filters)
        by_file_type = await self._group_documents_by_file_type(common_filters)
        by_org_unit = await self._group_documents_by_org_unit(common_filters)

        local_runs, local_files, local_files_unranged = await self._local_organize_metrics(
            tenant_id=tenant_id
        )
        signals = ReportsDocumentActivitySignals(
            unclassified_documents=await self._count_documents(
                [*common_filters, Document.classification_status.in_(("pending", "needs_review", "rejected"))]
            ),
            documents_missing_information=await self._count_documents(
                [
                    *common_filters,
                    or_(
                        Document.document_category_id.is_(None),
                        Document.classification_domain_id.is_(None),
                        Document.classification_activity_id.is_(None),
                        Document.classification_year.is_(None),
                    ),
                ]
            ),
            documents_needing_review=reviewed_documents,
            imports_needing_review=await self._count_open_import_reviews(tenant_id=tenant_id),
            local_organize_runs=local_runs,
            local_organize_files=local_files,
            local_organize_files_unranged=local_files_unranged,
        )

        return ReportsDocumentActivityResponse(
            total_active_documents=total_active_documents,
            validated_documents=validated_documents,
            archived_documents=archived_documents,
            reviewed_documents=reviewed_documents,
            by_status=by_status,
            by_file_type=by_file_type,
            by_org_unit=by_org_unit,
            signals=signals,
            availability=ReportsDocumentActivityAvailability(),
        )

    async def get_workflow_activity(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> ReportsWorkflowActivityResponse:
        workflow_filters = self._workflow_filters(
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            recursive=recursive,
            domain_id=domain_id,
            activity_id=activity_id,
            document_category_id=document_category_id,
        )

        active_steps = await self._count_workflow_steps(
            [*workflow_filters, WorkflowStep.status.in_(("current", "pending", "pending_assignment"))]
        )
        completed_steps = await self._count_workflow_steps(
            [*workflow_filters, WorkflowStep.status == "completed"]
        )
        rejected_steps = await self._count_workflow_steps(
            [*workflow_filters, WorkflowStep.status.in_(("rejected", "returned", "cancelled"))]
        )
        open_workflows = await self._count_distinct_workflow_documents(
            [*workflow_filters, WorkflowStep.status.in_(("current", "pending", "pending_assignment"))]
        )
        completed_workflows = await self._count_distinct_workflow_documents(
            [*workflow_filters, WorkflowStep.status == "completed"]
        )
        blocked_workflows_estimated = await self._count_distinct_workflow_documents(
            [
                *workflow_filters,
                WorkflowStep.status.in_(("current", "pending", "pending_assignment")),
                WorkflowStep.created_at < datetime.utcnow() - timedelta(days=5),
            ]
        )

        return ReportsWorkflowActivityResponse(
            active_steps=active_steps,
            completed_steps=completed_steps,
            rejected_steps=rejected_steps,
            open_workflows=open_workflows,
            completed_workflows=completed_workflows,
            blocked_workflows_estimated=blocked_workflows_estimated,
            by_step=await self._group_workflow_steps_by_label(workflow_filters),
            pending_actions=await self._group_pending_actions(workflow_filters),
            slowest_steps=await self._group_workflow_delays_by_step(workflow_filters),
            delay_by_org_unit=await self._group_workflow_delays_by_org_unit(workflow_filters),
            availability=ReportsWorkflowActivityAvailability(),
        )

    async def get_service_activity(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> ReportsServiceActivityResponse:
        base_org_units = await self._list_report_org_units(
            tenant_id=tenant_id,
            org_unit_id=org_unit_id,
            recursive=recursive,
        )
        services: list[ReportsServiceActivityItem] = []

        for unit in base_org_units:
            unit_filters = self._document_filters(
                metric="documents_created",
                tenant_id=tenant_id,
                date_from=None,
                date_to=None,
                org_unit_id=unit.id,
                recursive=True,
                domain_id=domain_id,
                activity_id=activity_id,
                document_category_id=document_category_id,
            )
            workflow_filters = self._workflow_filters(
                tenant_id=tenant_id,
                org_unit_id=unit.id,
                recursive=True,
                domain_id=domain_id,
                activity_id=activity_id,
                document_category_id=document_category_id,
            )

            documents_total = await self._count_documents(unit_filters)
            documents_in_progress = await self._count_documents(
                [*unit_filters, Document.status.in_(("draft", "in_review", "returned"))]
            )
            documents_needing_review = await self._count_documents(
                [*unit_filters, Document.classification_status == "needs_review"]
            )
            open_workflows = await self._count_distinct_workflow_documents(
                [*workflow_filters, WorkflowStep.status.in_(("current", "pending", "pending_assignment"))]
            )
            estimated_delays = await self._count_distinct_workflow_documents(
                [
                    *workflow_filters,
                    WorkflowStep.status.in_(("current", "pending", "pending_assignment")),
                    WorkflowStep.created_at < datetime.utcnow() - timedelta(days=5),
                ]
            )
            average_workflow_days = await self._average_workflow_days(workflow_filters)
            active_users, inactive_users = await self._count_users_activity(
                tenant_id=tenant_id,
                org_unit_id=unit.id,
                recursive=True,
            )

            if any([
                documents_total,
                documents_in_progress,
                documents_needing_review,
                open_workflows,
                estimated_delays,
                active_users,
                inactive_users,
            ]):
                services.append(
                    ReportsServiceActivityItem(
                        id=unit.id,
                        label=unit.name,
                        documents_total=documents_total,
                        documents_in_progress=documents_in_progress,
                        documents_needing_review=documents_needing_review,
                        open_workflows=open_workflows,
                        estimated_delays=estimated_delays,
                        average_workflow_days=average_workflow_days,
                        active_users=active_users,
                        inactive_users=inactive_users,
                    )
                )

        services.sort(
            key=lambda item: (
                item.estimated_delays,
                item.documents_in_progress,
                item.open_workflows,
                item.documents_total,
            ),
            reverse=True,
        )

        return ReportsServiceActivityResponse(
            services=services[:12],
            total_services=len(services),
            overloaded_services=len(
                [item for item in services if item.documents_in_progress > 0 or item.estimated_delays > 0]
            ),
            services_with_reviews=len([item for item in services if item.documents_needing_review > 0]),
            availability={
                "active_users": True,
                "inactive_users": True,
                "average_workflow_days": True,
            },
        )

    async def _build_series(
        self,
        *,
        metric: ReportsSeriesKey,
        tenant_id: UUID,
        date_from: date,
        date_to: date,
        granularity: ReportsGranularity,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> list[ReportsTimeseriesPoint]:
        bucket_expr = func.date_trunc(granularity, Document.created_at)
        stmt = (
            select(
                bucket_expr.label("bucket_start"),
                func.count(Document.id).label("value"),
            )
            .where(*self._document_filters(
                metric=metric,
                tenant_id=tenant_id,
                date_from=date_from,
                date_to=date_to,
                org_unit_id=org_unit_id,
                recursive=recursive,
                domain_id=domain_id,
                activity_id=activity_id,
                document_category_id=document_category_id,
            ))
            .group_by(bucket_expr)
            .order_by(bucket_expr.asc())
        )
        result = await self.db.execute(stmt)
        raw_points = {
            row.bucket_start.date(): int(row.value)
            for row in result.all()
            if row.bucket_start is not None
        }

        points: list[ReportsTimeseriesPoint] = []
        for bucket_start in self._iter_buckets(date_from, date_to, granularity):
            points.append(
                ReportsTimeseriesPoint(
                    bucket_start=bucket_start,
                    bucket_label=self._format_bucket_label(bucket_start, granularity),
                    value=raw_points.get(bucket_start, 0),
                )
            )
        return points

    async def _top_org_units_for_metric(
        self,
        *,
        metric: ReportsSeriesKey,
        tenant_id: UUID,
        date_from: date,
        date_to: date,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> list[ReportsBreakdownItem]:
        from app.models.org_unit import OrgUnit

        stmt = (
            select(
                OrgUnit.id,
                OrgUnit.name,
                func.count(Document.id).label("value"),
            )
            .join(OrgUnit, OrgUnit.id == Document.org_unit_id)
            .where(*self._document_filters(
                metric=metric,
                tenant_id=tenant_id,
                date_from=date_from,
                date_to=date_to,
                org_unit_id=org_unit_id,
                recursive=recursive,
                domain_id=domain_id,
                activity_id=activity_id,
                document_category_id=document_category_id,
            ))
            .group_by(OrgUnit.id, OrgUnit.name)
            .order_by(func.count(Document.id).desc(), OrgUnit.name.asc())
            .limit(5)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsBreakdownItem(id=row.id, label=row.name, value=int(row.value))
            for row in result.all()
        ]

    def _document_filters(
        self,
        *,
        metric: ReportsSeriesKey,
        tenant_id: UUID,
        date_from: Optional[date],
        date_to: Optional[date],
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> list:
        filters = [
            Document.tenant_id == tenant_id,
            Document.deleted_at.is_(None),
        ]

        if date_from is not None:
            filters.append(Document.created_at >= self._start_of_day(date_from))
        if date_to is not None:
            filters.append(Document.created_at < self._start_of_day(date_to + timedelta(days=1)))

        if org_unit_id:
            if recursive:
                descendant_ids = select(OrgUnitClosure.descendant_id).where(
                    OrgUnitClosure.ancestor_id == org_unit_id
                )
                filters.append(
                    or_(
                        Document.org_unit_id == org_unit_id,
                        Document.org_unit_id.in_(descendant_ids),
                    )
                )
            else:
                filters.append(Document.org_unit_id == org_unit_id)

        if domain_id:
            filters.append(Document.classification_domain_id == domain_id)
        if activity_id:
            filters.append(Document.classification_activity_id == activity_id)
        if document_category_id:
            filters.append(Document.document_category_id == document_category_id)
        if metric == "documents_auto_classified":
            filters.append(Document.classification_status == "classified")
        elif metric == "documents_needing_review":
            filters.append(Document.classification_status == "needs_review")

        return filters

    async def _count_documents(self, filters: list) -> int:
        stmt = select(func.count(Document.id)).where(*filters)
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def _group_documents_by_status(
        self,
        filters: list,
    ) -> list[ReportsDocumentActivityBreakdownItem]:
        labels = {
            "draft": "Brouillon",
            "in_review": "En analyse",
            "validated": "Validé",
            "signed": "Signé",
            "archived": "Archivé",
            "rejected": "Rejeté",
            "returned": "Retourné pour correction",
        }
        stmt = (
            select(Document.status, func.count(Document.id).label("value"))
            .where(*filters)
            .group_by(Document.status)
            .order_by(func.count(Document.id).desc(), Document.status.asc())
        )
        result = await self.db.execute(stmt)
        return [
            ReportsDocumentActivityBreakdownItem(
                key=str(row.status or "unknown"),
                label=labels.get(str(row.status), str(row.status or "Inconnu")),
                value=int(row.value),
            )
            for row in result.all()
        ]

    async def _group_documents_by_file_type(
        self,
        filters: list,
    ) -> list[ReportsDocumentActivityBreakdownItem]:
        file_type_expr = func.lower(func.coalesce(Document.file_type, "inconnu"))
        stmt = (
            select(
                file_type_expr.label("file_type"),
                func.count(Document.id).label("value"),
            )
            .where(*filters)
            .group_by(file_type_expr)
            .order_by(func.count(Document.id).desc(), file_type_expr.asc())
            .limit(8)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsDocumentActivityBreakdownItem(
                key=str(row.file_type),
                label=str(row.file_type).upper(),
                value=int(row.value),
            )
            for row in result.all()
        ]

    async def _group_documents_by_org_unit(
        self,
        filters: list,
    ) -> list[ReportsDocumentActivityBreakdownItem]:
        stmt = (
            select(
                OrgUnit.id,
                OrgUnit.name,
                func.count(Document.id).label("value"),
            )
            .join(OrgUnit, OrgUnit.id == Document.org_unit_id)
            .where(*filters)
            .group_by(OrgUnit.id, OrgUnit.name)
            .order_by(func.count(Document.id).desc(), OrgUnit.name.asc())
            .limit(5)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsDocumentActivityBreakdownItem(
                key=str(row.id),
                label=str(row.name),
                value=int(row.value),
            )
            for row in result.all()
        ]

    async def _count_open_import_reviews(self, *, tenant_id: UUID) -> int:
        stmt = select(func.count(ClassificationReview.id)).where(
            ClassificationReview.tenant_id == tenant_id,
            ClassificationReview.review_status == "open",
            ClassificationReview.import_job_item_id.is_not(None),
            ClassificationReview.document_id.is_(None),
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def _local_organize_metrics(
        self, *, tenant_id: UUID
    ) -> tuple[int, int, int]:
        """Compteurs agrégés du mode « Ranger sur mon poste » pour le tenant.

        Retourne (nb_runs, total_files, total_files_unranged). Aucun fichier
        ni nom n'est lu — uniquement les compteurs anonymes enregistrés via
        POST /api/v1/usage/local-organize.
        """
        stmt = select(
            func.count(LocalOrganizeEvent.id),
            func.coalesce(func.sum(LocalOrganizeEvent.file_count), 0),
            func.coalesce(func.sum(LocalOrganizeEvent.files_unranged), 0),
        ).where(LocalOrganizeEvent.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        row = result.one_or_none()
        if row is None:
            return (0, 0, 0)
        runs, files, unranged = row
        return (int(runs or 0), int(files or 0), int(unranged or 0))

    def _workflow_filters(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: Optional[UUID],
        recursive: bool,
        domain_id: Optional[UUID],
        activity_id: Optional[UUID],
        document_category_id: Optional[UUID],
    ) -> list:
        filters = [
            Document.tenant_id == tenant_id,
            Document.deleted_at.is_(None),
        ]

        if org_unit_id:
            if recursive:
                descendant_ids = select(OrgUnitClosure.descendant_id).where(
                    OrgUnitClosure.ancestor_id == org_unit_id
                )
                filters.append(
                    or_(
                        Document.org_unit_id == org_unit_id,
                        Document.org_unit_id.in_(descendant_ids),
                    )
                )
            else:
                filters.append(Document.org_unit_id == org_unit_id)

        if domain_id:
            filters.append(Document.classification_domain_id == domain_id)
        if activity_id:
            filters.append(Document.classification_activity_id == activity_id)
        if document_category_id:
            filters.append(Document.document_category_id == document_category_id)

        return filters

    async def _count_workflow_steps(self, filters: list) -> int:
        stmt = (
            select(func.count(WorkflowStep.id))
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(*filters)
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def _count_distinct_workflow_documents(self, filters: list) -> int:
        stmt = (
            select(func.count(func.distinct(WorkflowStep.document_id)))
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(*filters)
        )
        result = await self.db.execute(stmt)
        return int(result.scalar_one() or 0)

    async def _group_workflow_steps_by_label(
        self,
        filters: list,
    ) -> list[ReportsWorkflowActivityBreakdownItem]:
        stmt = (
            select(
                WorkflowStep.label,
                func.count(WorkflowStep.id).label("value"),
            )
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(
                *filters,
                WorkflowStep.status.in_(("current", "pending", "pending_assignment")),
            )
            .group_by(WorkflowStep.label)
            .order_by(func.count(WorkflowStep.id).desc(), WorkflowStep.label.asc())
            .limit(8)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsWorkflowActivityBreakdownItem(
                key=(row.label or "sans-etape").lower().replace(" ", "_"),
                label=row.label or "Étape non nommée",
                value=int(row.value),
            )
            for row in result.all()
        ]

    async def _group_pending_actions(
        self,
        filters: list,
    ) -> list[ReportsWorkflowActivityBreakdownItem]:
        labels = {
            "final_signature": "En attente de signature",
            "approval": "En attente de validation",
            "visa": "En attente d'avis",
            "read_ack": "En attente d'accusé",
            "pending_assignment": "En attente d'affectation",
        }
        action_key = case(
            (
                WorkflowStep.status == "pending_assignment",
                "pending_assignment",
            ),
            else_=func.coalesce(
                func.nullif(WorkflowStep.expected_action_type.cast(String), ""),
                "pending_assignment",
            ),
        )
        stmt = (
            select(
                action_key.label("action_key"),
                func.count(WorkflowStep.id).label("value"),
            )
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(
                *filters,
                WorkflowStep.status.in_(("current", "pending", "pending_assignment")),
            )
            .group_by(action_key)
            .order_by(func.count(WorkflowStep.id).desc(), action_key.asc())
        )
        result = await self.db.execute(stmt)
        return [
            ReportsWorkflowActivityBreakdownItem(
                key=str(row.action_key),
                label=labels.get(str(row.action_key), str(row.action_key)),
                value=int(row.value),
            )
            for row in result.all()
        ]

    async def _group_workflow_delays_by_step(
        self,
        filters: list,
    ) -> list[ReportsWorkflowDelayItem]:
        duration_days = func.extract(
            "epoch",
            WorkflowStep.completed_at - WorkflowStep.created_at,
        ) / 86400.0
        stmt = (
            select(
                WorkflowStep.label,
                func.avg(duration_days).label("average_days"),
                func.count(WorkflowStep.id).label("steps_count"),
            )
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(
                *filters,
                WorkflowStep.status == "completed",
                WorkflowStep.completed_at.is_not(None),
            )
            .group_by(WorkflowStep.label)
            .order_by(func.avg(duration_days).desc(), WorkflowStep.label.asc())
            .limit(5)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsWorkflowDelayItem(
                key=(row.label or "sans-etape").lower().replace(" ", "_"),
                label=row.label or "Étape non nommée",
                average_days=round(float(row.average_days or 0), 1),
                steps_count=int(row.steps_count or 0),
            )
            for row in result.all()
        ]

    async def _group_workflow_delays_by_org_unit(
        self,
        filters: list,
    ) -> list[ReportsWorkflowDelayItem]:
        duration_days = func.extract(
            "epoch",
            WorkflowStep.completed_at - WorkflowStep.created_at,
        ) / 86400.0
        stmt = (
            select(
                OrgUnit.id,
                OrgUnit.name,
                func.avg(duration_days).label("average_days"),
                func.count(WorkflowStep.id).label("steps_count"),
            )
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .join(OrgUnit, OrgUnit.id == Document.org_unit_id)
            .where(
                *filters,
                WorkflowStep.status == "completed",
                WorkflowStep.completed_at.is_not(None),
            )
            .group_by(OrgUnit.id, OrgUnit.name)
            .order_by(func.avg(duration_days).desc(), OrgUnit.name.asc())
            .limit(5)
        )
        result = await self.db.execute(stmt)
        return [
            ReportsWorkflowDelayItem(
                key=str(row.id),
                label=str(row.name),
                average_days=round(float(row.average_days or 0), 1),
                steps_count=int(row.steps_count or 0),
            )
            for row in result.all()
        ]

    async def _average_workflow_days(self, filters: list) -> float:
        duration_days = func.extract(
            "epoch",
            WorkflowStep.completed_at - WorkflowStep.created_at,
        ) / 86400.0
        stmt = (
            select(func.avg(duration_days))
            .select_from(WorkflowStep)
            .join(Document, Document.id == WorkflowStep.document_id)
            .where(
                *filters,
                WorkflowStep.status == "completed",
                WorkflowStep.completed_at.is_not(None),
            )
        )
        result = await self.db.execute(stmt)
        return round(float(result.scalar_one() or 0), 1)

    async def _list_report_org_units(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: Optional[UUID],
        recursive: bool,
    ) -> list[OrgUnit]:
        stmt = (
            select(OrgUnit)
            .where(
                OrgUnit.tenant_id == tenant_id,
                OrgUnit.is_active.is_(True),
            )
            .order_by(OrgUnit.level.asc(), OrgUnit.name.asc())
        )
        if org_unit_id:
            if recursive:
                descendant_ids = select(OrgUnitClosure.descendant_id).where(
                    OrgUnitClosure.ancestor_id == org_unit_id
                )
                stmt = stmt.where(
                    or_(
                        OrgUnit.id == org_unit_id,
                        OrgUnit.id.in_(descendant_ids),
                    )
                )
            else:
                stmt = stmt.where(OrgUnit.id == org_unit_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _count_users_activity(
        self,
        *,
        tenant_id: UUID,
        org_unit_id: UUID,
        recursive: bool,
    ) -> tuple[int, int]:
        org_filter = User.org_unit_id == org_unit_id
        if recursive:
            descendant_ids = select(OrgUnitClosure.descendant_id).where(
                OrgUnitClosure.ancestor_id == org_unit_id
            )
            org_filter = or_(
                User.org_unit_id == org_unit_id,
                User.org_unit_id.in_(descendant_ids),
            )

        recent_threshold = datetime.utcnow() - timedelta(days=30)
        active_stmt = select(func.count(User.id)).where(
            User.tenant_id == tenant_id,
            org_filter,
            User.is_active.is_(True),
            User.last_login.is_not(None),
            User.last_login >= recent_threshold,
        )
        inactive_stmt = select(func.count(User.id)).where(
            User.tenant_id == tenant_id,
            org_filter,
            User.is_active.is_(True),
            or_(User.last_login.is_(None), User.last_login < recent_threshold),
        )
        active_result = await self.db.execute(active_stmt)
        inactive_result = await self.db.execute(inactive_stmt)
        return int(active_result.scalar_one() or 0), int(inactive_result.scalar_one() or 0)

    @staticmethod
    def _normalize_dates(
        date_from: Optional[date],
        date_to: Optional[date],
    ) -> tuple[date, date]:
        today = date.today()
        effective_to = date_to or today
        effective_from = date_from or (effective_to - timedelta(days=29))
        if effective_from > effective_to:
            raise ValueError("date_from must be before or equal to date_to")
        return effective_from, effective_to

    @staticmethod
    def _start_of_day(value: date) -> datetime:
        return datetime.combine(value, datetime.min.time())

    @staticmethod
    def _iter_buckets(
        date_from: date,
        date_to: date,
        granularity: ReportsGranularity,
    ) -> list[date]:
        current = ReportsService._align_bucket_start(date_from, granularity)
        end = ReportsService._align_bucket_start(date_to, granularity)
        buckets: list[date] = []

        while current <= end:
            buckets.append(current)
            if granularity == "day":
                current += timedelta(days=1)
            elif granularity == "week":
                current += timedelta(days=7)
            else:
                current = ReportsService._next_month(current)
        return buckets

    @staticmethod
    def _align_bucket_start(value: date, granularity: ReportsGranularity) -> date:
        if granularity == "day":
            return value
        if granularity == "week":
            return value - timedelta(days=value.weekday())
        return value.replace(day=1)

    @staticmethod
    def _next_month(value: date) -> date:
        if value.month == 12:
            return date(value.year + 1, 1, 1)
        return date(value.year, value.month + 1, 1)

    @staticmethod
    def _format_bucket_label(value: date, granularity: ReportsGranularity) -> str:
        if granularity == "day":
            return value.strftime("%d/%m/%Y")
        if granularity == "week":
            return f"Semaine du {value.strftime('%d/%m/%Y')}"
        return value.strftime("%m/%Y")
