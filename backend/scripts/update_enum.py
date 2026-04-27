import asyncio
import os
import sys

# Ajouter le répertoire backend au sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.core.database import async_session_maker


async def main():
    async with async_session_maker() as session:
        try:
            print("Tentative d'ajout de la nouvelle valeur à l'enum assignmentscope...")
            # En PostgreSQL, on altere l'enum directement
            await session.execute(
                text(
                    "ALTER TYPE assignmentscope ADD VALUE IF NOT EXISTS 'grandparent_org_unit'"
                )
            )
            await session.commit()
            print("Succès !")
        except Exception as e:
            print(f"Erreur (peut-être que la valeur existe déjà) : {e}")


if __name__ == "__main__":
    asyncio.run(main())
