"""
Seed script for E-Dossier Cameroun.
Creates realistic test data matching the SCENARIOS_TEST.md scenarios.

Usage:
    cd backend
    python scripts/seed_db.py
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from app.core.database import engine, AsyncSessionLocal
from app.core.schema_check import get_schema_status
from app.core.security import hash_password
from app.core.authz.roles import ROLE_CODES
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.org_unit import OrgUnit, OrgUnitType
from app.models.user import User
from app.models.document import Document
from app.models.workflow import WorkflowStep, ActionType

import uuid


REFERENCE_ATTRS = ("label", "hierarchy_level", "description", "level")

# Same codes and labels as alembic 001_initial_schema: the seed reconciles the
# reference rows the migrations already inserted instead of adding look-alikes
# (LESSON-2026-021). tests/test_seed_db.py checks this against the migration.
ORG_UNIT_TYPES = (
    {"code": "MINISTRY", "label": "Ministère", "level": 1},
    {"code": "DIRECTION", "label": "Direction", "level": 2},
    {"code": "DEPARTMENT", "label": "Département", "level": 3},
    {"code": "SERVICE", "label": "Service", "level": 4},
)


async def upsert_by_code(db, model, rows):
    """Reconcile reference rows (roles, org unit types) by ``code``.

    A row already present is updated in place, a missing one is inserted; ids
    are never forced, so the seed converges on a database that the alembic
    migrations (or an earlier seed) already populated. Returns ``{code: id}``.
    """
    existing = {row.code: row for row in (await db.execute(select(model))).scalars()}
    ids = {}
    for row in rows:
        current = existing.get(row.code)
        if current is None:
            db.add(row)
            await db.flush()
            current = row
        else:
            for attr in REFERENCE_ATTRS:
                if hasattr(row, attr) and getattr(row, attr) is not None:
                    setattr(current, attr, getattr(row, attr))
        ids[row.code] = current.id
    await db.flush()
    return ids


async def seed():
    print("=== E-Dossier Cameroun - Database Seed ===\n")

    # 1. The schema comes from the migrations only (`alembic upgrade head`): the
    # seed never builds tables from the models, so a database that is not at
    # head stops here with the fix to apply instead of failing half-way.
    status = await get_schema_status(engine)
    if not status.at_head:
        print(f"[ERROR] {status.describe()}")
        sys.exit(2)
    print(f"[OK] Schema at Alembic head ({', '.join(sorted(status.expected))})")

    async with AsyncSessionLocal() as db:
        # ─── ROLES ────────────────────────────────────────
        roles = [
            Role(
                code="super_admin",
                label="Super Administrateur",
                hierarchy_level=1,
                description="Administrateur de la plateforme",
            ),
            Role(
                code="tenant_admin",
                label="Administrateur Tenant",
                hierarchy_level=2,
                description="Administrateur d'un ministere",
            ),
            Role(
                code="unit_admin",
                label="Administrateur Unite",
                hierarchy_level=3,
                description="Responsable d'une direction/service",
            ),
            Role(
                code="manager",
                label="Manager / Valideur",
                hierarchy_level=4,
                description="Valideur et signataire",
            ),
            Role(
                code="collaborator",
                label="Collaborateur",
                hierarchy_level=5,
                description="Agent contributeur",
            ),
            Role(
                code="reader",
                label="Lecteur",
                hierarchy_level=6,
                description="Consultation uniquement",
            ),
            Role(
                code="auditor",
                label="Auditeur",
                hierarchy_level=7,
                description="Compliance et audit",
            ),
        ]
        # The seed and the policy must name the same roles (LESSON-2026-021).
        assert {r.code for r in roles} == ROLE_CODES, {
            r.code for r in roles
        } ^ ROLE_CODES
        role_ids = await upsert_by_code(db, Role, roles)
        print(f"[OK] {len(role_ids)} roles reconciled")

        # ─── ORG UNIT TYPES ──────────────────────────────
        org_types = [OrgUnitType(**row) for row in ORG_UNIT_TYPES]
        type_ids = await upsert_by_code(db, OrgUnitType, org_types)

        # Idempotence guard on the demo data itself, not on the reference
        # tables (which the migrations also fill): re-running the seed must
        # never duplicate tenants, units, users or documents.
        minfi = await db.execute(select(Tenant).where(Tenant.short_name == "MINFI"))
        if minfi.scalar_one_or_none() is not None:
            await db.commit()
            print(
                "[SKIP] Demo tenant MINFI already present; reference data reconciled only."
            )
            return
        print("[OK] 4 org unit types reconciled")

        # ─── TENANTS ─────────────────────────────────────
        # PLATFORM : tenant systeme heberge les super_admins (non-visible aux autres roles).
        platform_id = uuid.uuid4()
        minfi_id = uuid.uuid4()
        minesup_id = uuid.uuid4()

        tenants = [
            Tenant(
                id=platform_id,
                name="Plateforme E-Dossier",
                short_name="PLATFORM",
                domain="platform.edossier.cm",
            ),
            Tenant(
                id=minfi_id,
                name="Ministere des Finances",
                short_name="MINFI",
                domain="minfi.gov.cm",
            ),
            Tenant(
                id=minesup_id,
                name="Ministere de l'Enseignement Superieur",
                short_name="MINESUP",
                domain="minesup.gov.cm",
            ),
        ]
        db.add_all(tenants)
        await db.flush()
        print("[OK] 3 tenants created (PLATFORM + MINFI + MINESUP)")

        # ─── ORG UNITS (MINFI) ───────────────────────────
        minfi_root_id = uuid.uuid4()
        minfi_drh_id = uuid.uuid4()
        minfi_daf_id = uuid.uuid4()
        minfi_dsi_id = uuid.uuid4()
        minfi_cab_id = uuid.uuid4()

        # MINESUP
        minesup_root_id = uuid.uuid4()
        minesup_daaj_id = uuid.uuid4()

        org_units = [
            # MINFI hierarchy
            OrgUnit(
                id=minfi_root_id,
                tenant_id=minfi_id,
                code="MINFI-CAB",
                name="Cabinet du Ministre",
                short_name="CAB",
                type_id=type_ids["MINISTRY"],
                level=1,
                path="/MINFI-CAB",
            ),
            OrgUnit(
                id=minfi_cab_id,
                tenant_id=minfi_id,
                parent_id=minfi_root_id,
                code="MINFI-SG",
                name="Secretariat General",
                short_name="SG",
                type_id=type_ids["DIRECTION"],
                level=2,
                path="/MINFI-CAB/MINFI-SG",
            ),
            OrgUnit(
                id=minfi_drh_id,
                tenant_id=minfi_id,
                parent_id=minfi_root_id,
                code="MINFI-DRH",
                name="Direction des Ressources Humaines",
                short_name="DRH",
                type_id=type_ids["DIRECTION"],
                level=2,
                path="/MINFI-CAB/MINFI-DRH",
            ),
            OrgUnit(
                id=minfi_daf_id,
                tenant_id=minfi_id,
                parent_id=minfi_root_id,
                code="MINFI-DAF",
                name="Direction des Affaires Financieres",
                short_name="DAF",
                type_id=type_ids["DIRECTION"],
                level=2,
                path="/MINFI-CAB/MINFI-DAF",
            ),
            OrgUnit(
                id=minfi_dsi_id,
                tenant_id=minfi_id,
                parent_id=minfi_root_id,
                code="MINFI-DSI",
                name="Direction des Systemes d'Information",
                short_name="DSI",
                type_id=type_ids["DIRECTION"],
                level=2,
                path="/MINFI-CAB/MINFI-DSI",
            ),
            # MINESUP hierarchy
            OrgUnit(
                id=minesup_root_id,
                tenant_id=minesup_id,
                code="MINESUP-CAB",
                name="Cabinet du Ministre",
                short_name="CAB",
                type_id=type_ids["MINISTRY"],
                level=1,
                path="/MINESUP-CAB",
            ),
            OrgUnit(
                id=minesup_daaj_id,
                tenant_id=minesup_id,
                parent_id=minesup_root_id,
                code="MINESUP-DAAJ",
                name="Direction des Affaires Academiques",
                short_name="DAAJ",
                type_id=type_ids["DIRECTION"],
                level=2,
                path="/MINESUP-CAB/MINESUP-DAAJ",
            ),
        ]
        db.add_all(org_units)
        await db.flush()
        print("[OK] 7 org units created (5 MINFI + 2 MINESUP)")

        # ─── USERS ───────────────────────────────────────
        super_admin_id = uuid.uuid4()
        tenant_admin_id = uuid.uuid4()
        unit_admin_id = uuid.uuid4()
        manager_id = uuid.uuid4()
        collab_id = uuid.uuid4()
        reader_id = uuid.uuid4()
        auditor_id = uuid.uuid4()
        minesup_user_id = uuid.uuid4()

        users = [
            # MINFI users
            User(
                id=super_admin_id,
                tenant_id=platform_id,
                org_unit_id=None,
                role_id=role_ids["super_admin"],
                matricule="SUPER001",
                email="super@edossier.cm",
                first_name="Jean-Pierre",
                last_name="Nguema",
                password_hash=hash_password("Admin@2025"),
                is_active=True,
            ),
            User(
                id=tenant_admin_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_root_id,
                role_id=role_ids["tenant_admin"],
                matricule="MINFI001",
                email="admin@minfi.gov.cm",
                first_name="Marie",
                last_name="Atangana",
                password_hash=hash_password("Minfi@2025"),
                is_active=True,
            ),
            User(
                id=unit_admin_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_drh_id,
                role_id=role_ids["unit_admin"],
                matricule="UNIT001",
                email="drh@minfi.gov.cm",
                first_name="Paul",
                last_name="Mvondo",
                password_hash=hash_password("Unit@2025"),
                is_active=True,
            ),
            User(
                id=manager_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_daf_id,
                role_id=role_ids["manager"],
                matricule="MGR001",
                email="manager@minfi.gov.cm",
                first_name="Celestin",
                last_name="Abena",
                password_hash=hash_password("Mgr@2025"),
                is_active=True,
            ),
            User(
                id=collab_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_daf_id,
                role_id=role_ids["collaborator"],
                matricule="MINFI002",
                email="collab@minfi.gov.cm",
                first_name="Rosine",
                last_name="Ngono",
                password_hash=hash_password("User@2025"),
                is_active=True,
            ),
            User(
                id=reader_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_dsi_id,
                role_id=role_ids["reader"],
                matricule="READ001",
                email="reader@minfi.gov.cm",
                first_name="Emmanuel",
                last_name="Fouda",
                password_hash=hash_password("Read@2025"),
                is_active=True,
            ),
            User(
                id=auditor_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_root_id,
                role_id=role_ids["auditor"],
                matricule="AUDIT001",
                email="audit@minfi.gov.cm",
                first_name="Sandrine",
                last_name="Biyiha",
                password_hash=hash_password("Audit@2025"),
                is_active=True,
            ),
            # MINESUP user (for multi-tenant isolation test)
            User(
                id=minesup_user_id,
                tenant_id=minesup_id,
                org_unit_id=minesup_root_id,
                role_id=role_ids["collaborator"],
                matricule="MINESUP001",
                email="user@minesup.gov.cm",
                first_name="Alain",
                last_name="Tchinda",
                password_hash=hash_password("Sup@2025"),
                is_active=True,
            ),
        ]
        db.add_all(users)
        await db.flush()
        print("[OK] 8 users created (7 MINFI + 1 MINESUP)")

        # ─── DOCUMENTS ──────────────────────────────────
        doc1_id = uuid.uuid4()
        doc2_id = uuid.uuid4()
        doc3_id = uuid.uuid4()
        doc4_id = uuid.uuid4()
        doc5_id = uuid.uuid4()
        doc6_id = uuid.uuid4()

        documents = [
            Document(
                id=doc1_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_daf_id,
                owner_id=collab_id,
                title="Budget Previsionnel 2026",
                file_path=f"{minfi_id}/{minfi_daf_id}/budget_2026.pdf",
                file_type="pdf",
                file_size=2_500_000,
                mime_type="application/pdf",
                tags=["budget", "2026", "previsionnel"],
                status="validated",
            ),
            Document(
                id=doc2_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_drh_id,
                owner_id=unit_admin_id,
                title="Note de Service RH - Conges Annuels",
                file_path=f"{minfi_id}/{minfi_drh_id}/note_rh_conges.docx",
                file_type="docx",
                file_size=450_000,
                mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                tags=["rh", "conges", "note-de-service"],
                status="in_review",
            ),
            Document(
                id=doc3_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_root_id,
                owner_id=tenant_admin_id,
                title="Circulaire Ministerielle - Digitalisation",
                file_path=f"{minfi_id}/{minfi_root_id}/circulaire_digital.pdf",
                file_type="pdf",
                file_size=1_200_000,
                mime_type="application/pdf",
                tags=["circulaire", "digital", "reforme"],
                status="draft",
            ),
            Document(
                id=doc4_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_daf_id,
                owner_id=manager_id,
                title="Rapport Audit Interne Q4 2025",
                file_path=f"{minfi_id}/{minfi_daf_id}/audit_q4_2025.pdf",
                file_type="pdf",
                file_size=3_100_000,
                mime_type="application/pdf",
                tags=["audit", "rapport", "q4"],
                status="validated",
            ),
            Document(
                id=doc5_id,
                tenant_id=minfi_id,
                org_unit_id=minfi_dsi_id,
                owner_id=reader_id,
                title="Specifications Techniques SI v2",
                file_path=f"{minfi_id}/{minfi_dsi_id}/specs_si_v2.pdf",
                file_type="pdf",
                file_size=5_800_000,
                mime_type="application/pdf",
                tags=["si", "specs", "architecture"],
                status="draft",
            ),
            # MINESUP document (for isolation test)
            Document(
                id=doc6_id,
                tenant_id=minesup_id,
                org_unit_id=minesup_root_id,
                owner_id=minesup_user_id,
                title="Plan Strategique MINESUP 2026-2030",
                file_path=f"{minesup_id}/{minesup_root_id}/plan_strat.pdf",
                file_type="pdf",
                file_size=4_200_000,
                mime_type="application/pdf",
                tags=["plan", "strategique"],
                status="draft",
            ),
        ]
        db.add_all(documents)
        await db.flush()
        print("[OK] 6 documents created (5 MINFI + 1 MINESUP)")

        # ─── WORKFLOW STEPS (for doc2 - in_review) ──────
        workflow_steps = [
            WorkflowStep(
                document_id=doc2_id,
                step_order=1,
                label="Verification DRH",
                status="completed",
                assigned_to=unit_admin_id,
                expected_action_type=ActionType.visa,
                comment="Conforme aux reglements RH.",
            ),
            WorkflowStep(
                document_id=doc2_id,
                step_order=2,
                label="Validation Manager",
                status="current",
                assigned_to=manager_id,
                expected_action_type=ActionType.visa,
            ),
            WorkflowStep(
                document_id=doc2_id,
                step_order=3,
                label="Signature Cabinet",
                status="pending",
                assigned_to=tenant_admin_id,
                expected_action_type=ActionType.final_signature,
            ),
        ]
        db.add_all(workflow_steps)
        await db.flush()
        print("[OK] 3 workflow steps created (doc2: in_review)")

        await db.commit()
        print("\n=== Seed complete! ===")
        print()
        print("Credentials de test:")
        print("-" * 55)
        print("  Super Admin  : SUPER001  / Admin@2025")
        print("  Admin MINFI  : MINFI001  / Minfi@2025")
        print("  Admin Unite  : UNIT001   / Unit@2025")
        print("  Manager      : MGR001    / Mgr@2025")
        print("  Collaborateur: MINFI002  / User@2025")
        print("  Lecteur      : READ001   / Read@2025")
        print("  Auditeur     : AUDIT001  / Audit@2025")
        print("  User MINESUP : MINESUP001/ Sup@2025")
        print("-" * 55)


if __name__ == "__main__":
    asyncio.run(seed())
