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

from sqlalchemy import text
from app.core.database import engine, AsyncSessionLocal, Base
from app.core.security import hash_password
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.org_unit import OrgUnit, OrgUnitType
from app.models.user import User
from app.models.document import Document
from app.models.workflow import WorkflowStep, ActionType

import uuid


async def seed():
    print("=== E-Dossier Cameroun - Database Seed ===\n")

    # 1. Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Tables created")

    async with AsyncSessionLocal() as db:
        # Check if already seeded
        result = await db.execute(text("SELECT COUNT(*) FROM roles"))
        count = result.scalar()
        if count and count > 0:
            print("[SKIP] Database already seeded. Drop tables first to re-seed.")
            print(
                "       Run: psql -U postgres -d edossier -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'"
            )
            return

        # ─── ROLES ────────────────────────────────────────
        roles = [
            Role(
                id=1,
                code="super_admin",
                label="Super Administrateur",
                hierarchy_level=1,
                description="Administrateur de la plateforme",
            ),
            Role(
                id=2,
                code="tenant_admin",
                label="Administrateur Tenant",
                hierarchy_level=2,
                description="Administrateur d'un ministere",
            ),
            Role(
                id=3,
                code="unit_admin",
                label="Administrateur Unite",
                hierarchy_level=3,
                description="Responsable d'une direction/service",
            ),
            Role(
                id=4,
                code="manager",
                label="Manager / Valideur",
                hierarchy_level=4,
                description="Valideur et signataire",
            ),
            Role(
                id=5,
                code="collaborator",
                label="Collaborateur",
                hierarchy_level=5,
                description="Agent contributeur",
            ),
            Role(
                id=6,
                code="reader",
                label="Lecteur",
                hierarchy_level=6,
                description="Consultation uniquement",
            ),
            Role(
                id=7,
                code="auditor",
                label="Auditeur",
                hierarchy_level=7,
                description="Compliance et audit",
            ),
        ]
        db.add_all(roles)
        await db.flush()
        print("[OK] 7 roles created")

        # ─── ORG UNIT TYPES ──────────────────────────────
        org_types = [
            OrgUnitType(id=1, code="ministry", label="Ministere", level=1),
            OrgUnitType(id=2, code="direction", label="Direction", level=2),
            OrgUnitType(id=3, code="sub_direction", label="Sous-Direction", level=3),
            OrgUnitType(id=4, code="service", label="Service", level=4),
        ]
        db.add_all(org_types)
        await db.flush()
        print("[OK] 4 org unit types created")

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
                type_id=1,
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
                type_id=2,
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
                type_id=2,
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
                type_id=2,
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
                type_id=2,
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
                type_id=1,
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
                type_id=2,
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
                role_id=1,
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
                role_id=2,
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
                role_id=3,
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
                role_id=4,
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
                role_id=5,
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
                role_id=6,
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
                role_id=7,
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
                role_id=5,
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
        print(f"  Super Admin  : SUPER001  / Admin@2025")
        print(f"  Admin MINFI  : MINFI001  / Minfi@2025")
        print(f"  Admin Unite  : UNIT001   / Unit@2025")
        print(f"  Manager      : MGR001    / Mgr@2025")
        print(f"  Collaborateur: MINFI002  / User@2025")
        print(f"  Lecteur      : READ001   / Read@2025")
        print(f"  Auditeur     : AUDIT001  / Audit@2025")
        print(f"  User MINESUP : MINESUP001/ Sup@2025")
        print("-" * 55)


if __name__ == "__main__":
    asyncio.run(seed())
