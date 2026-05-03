"""Initialize database with seed data"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models import Tenant, Role, OrgUnit, User, OrgUnitType
import uuid


async def create_seed_data():
    """Create initial seed data"""
    async with AsyncSessionLocal() as session:
        try:
            # Check if data already exists
            result = await session.execute(select(Tenant))
            existing_tenant = result.scalar_one_or_none()

            if existing_tenant:
                print("⚠️  Seed data already exists. Skipping...")
                return

            print("🌱 Creating seed data...")

            # Create test tenant (MINFI)
            tenant_minfi = Tenant(
                name="Ministere des Finances",
                short_name="MINFI",
                domain="minfi.cm",
                settings={},
                is_active=True,
            )
            session.add(tenant_minfi)
            await session.flush()

            # Get org unit types
            result = await session.execute(
                select(OrgUnitType).where(OrgUnitType.code == "MINISTRY")
            )
            ministry_type = result.scalar_one()

            result = await session.execute(
                select(OrgUnitType).where(OrgUnitType.code == "DIRECTION")
            )
            direction_type = result.scalar_one()

            result = await session.execute(
                select(OrgUnitType).where(OrgUnitType.code == "SERVICE")
            )
            service_type = result.scalar_one()

            # Create org units
            minfi_root = OrgUnit(
                tenant_id=tenant_minfi.id,
                parent_id=None,
                code="MINFI",
                name="Ministere des Finances",
                short_name="MINFI",
                type_id=ministry_type.id,
                level=1,
                path="/MINFI",
                extra_data={},
                is_active=True,
            )
            session.add(minfi_root)
            await session.flush()

            dgi = OrgUnit(
                tenant_id=tenant_minfi.id,
                parent_id=minfi_root.id,
                code="DGI",
                name="Direction Generale des Impots",
                short_name="DGI",
                type_id=direction_type.id,
                level=2,
                path="/MINFI/DGI",
                extra_data={},
                is_active=True,
            )
            session.add(dgi)
            await session.flush()

            service_info = OrgUnit(
                tenant_id=tenant_minfi.id,
                parent_id=dgi.id,
                code="SRV-INFO",
                name="Service Informatique",
                short_name="INFO",
                type_id=service_type.id,
                level=3,
                path="/MINFI/DGI/SRV-INFO",
                extra_data={},
                is_active=True,
            )
            session.add(service_info)
            await session.flush()

            # Get roles
            result = await session.execute(
                select(Role).where(Role.code == "SUPER_ADMIN")
            )
            super_admin_role = result.scalar_one()

            result = await session.execute(
                select(Role).where(Role.code == "TENANT_ADMIN")
            )
            tenant_admin_role = result.scalar_one()

            result = await session.execute(
                select(Role).where(Role.code == "COLLABORATOR")
            )
            collaborator_role = result.scalar_one()

            # Create users
            super_admin = User(
                tenant_id=tenant_minfi.id,
                org_unit_id=minfi_root.id,
                role_id=super_admin_role.id,
                matricule="SUPER001",
                email="admin@edossier.cm",
                first_name="Super",
                last_name="Admin",
                password_hash=hash_password("admin123"),
                profile_data={},
                is_active=True,
            )
            session.add(super_admin)

            tenant_admin = User(
                tenant_id=tenant_minfi.id,
                org_unit_id=minfi_root.id,
                role_id=tenant_admin_role.id,
                matricule="MINFI001",
                email="admin@minfi.cm",
                first_name="Jean",
                last_name="Dupont",
                password_hash=hash_password("minfi123"),
                profile_data={},
                is_active=True,
            )
            session.add(tenant_admin)

            collaborator = User(
                tenant_id=tenant_minfi.id,
                org_unit_id=service_info.id,
                role_id=collaborator_role.id,
                matricule="MINFI002",
                email="user@minfi.cm",
                first_name="Marie",
                last_name="Kouam",
                password_hash=hash_password("user123"),
                profile_data={},
                is_active=True,
            )
            session.add(collaborator)

            await session.commit()
            print("✅ Seed data created successfully!")
            print("\n📋 Test Credentials:")
            print("─" * 50)
            print("Super Admin:")
            print("  Matricule: SUPER001")
            print("  Password: admin123")
            print("\nTenant Admin (MINFI):")
            print("  Matricule: MINFI001")
            print("  Password: minfi123")
            print("\nCollaborator:")
            print("  Matricule: MINFI002")
            print("  Password: user123")
            print("─" * 50)

        except Exception as e:
            await session.rollback()
            print(f"❌ Error creating seed data: {e}")
            import traceback

            traceback.print_exc()
            raise


if __name__ == "__main__":
    print("🌱 Initializing database with seed data...")
    asyncio.run(create_seed_data())
