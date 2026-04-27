"""
Migration idempotente : cree le tenant systeme PLATFORM et y rattache tous les super_admins.

A executer sur une base deja seedee (dev ou prod) pour appliquer la decision
d'architecture "option 2" (tenant systeme heberge les super_admins).

Usage:
    cd backend
    python scripts/migrate_platform_tenant.py
"""

import asyncio
import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.role import Role
from app.models.tenant import Tenant
from app.models.user import User

PLATFORM_SHORT_NAME = "PLATFORM"


async def migrate():
    print("=== Migration : creation du tenant systeme PLATFORM ===")

    async with AsyncSessionLocal() as db:
        # 1. Creer le tenant PLATFORM s'il n'existe pas
        existing = await db.execute(
            select(Tenant).filter(Tenant.short_name == PLATFORM_SHORT_NAME)
        )
        platform = existing.scalar_one_or_none()

        if platform is None:
            platform = Tenant(
                id=uuid.uuid4(),
                name="Plateforme E-Dossier",
                short_name=PLATFORM_SHORT_NAME,
                domain="platform.edossier.cm",
                is_active=True,
            )
            db.add(platform)
            await db.flush()
            print(f"[OK] Tenant PLATFORM cree (id={platform.id})")
        else:
            print(f"[SKIP] Tenant PLATFORM existe deja (id={platform.id})")

        # 2. Trouver le role super_admin
        super_role = (
            await db.execute(select(Role).filter(Role.code == "super_admin"))
        ).scalar_one_or_none()
        if super_role is None:
            print("[ERR] Role super_admin introuvable, abandon.")
            return

        # 3. Rattacher tous les super_admins au tenant PLATFORM + detacher leur org_unit
        supers = (
            (await db.execute(select(User).filter(User.role_id == super_role.id)))
            .scalars()
            .all()
        )

        migrated = 0
        for u in supers:
            if u.tenant_id != platform.id or u.org_unit_id is not None:
                old_tenant = u.tenant_id
                u.tenant_id = platform.id
                u.org_unit_id = None
                db.add(u)
                migrated += 1
                print(
                    f"  - {u.matricule} : tenant {old_tenant} -> PLATFORM, org_unit detache"
                )

        await db.commit()
        print(f"[OK] {migrated} super_admin(s) migre(s) vers PLATFORM")
        print(f"     {len(supers) - migrated} super_admin(s) deja sur PLATFORM")


if __name__ == "__main__":
    asyncio.run(migrate())
