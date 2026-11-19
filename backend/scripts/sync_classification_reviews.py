"""
Rattrapage idempotent de l'écran de revue du classement.

L'écran de revue liste les lignes de ``classification_reviews``. Avant ce correctif,
l'import par dossier, le dossier surveillé et le passage après OCR ne créaient pas ces
lignes : des documents « à vérifier » n'apparaissaient pas à l'écran, et une revue ouverte
à l'envoi restait ouverte après un classement par l'OCR.

Le script applique la même règle que l'application
(``ClassificationReviewService.sync_review_with_document_status``) :
- document « à vérifier » (pending, needs_review) sans revue ouverte ni résolue → revue ouverte ;
- revue ouverte sur un document classé → revue annulée (jamais supprimée).
Une revue résolue par une personne n'est jamais rouverte. Rien n'est supprimé.

Usage (dans le conteneur api) :
    python scripts/sync_classification_reviews.py            # plan : compte, n'écrit rien
    python scripts/sync_classification_reviews.py --apply    # applique
    python scripts/sync_classification_reviews.py --apply --tenant <uuid>
Un second ``--apply`` ne trouve plus rien à faire.
"""

import argparse
import asyncio
import os
import sys
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal  # noqa: E402
from app.services.classification_review_service import (  # noqa: E402
    ClassificationReviewService,
)


async def run(apply: bool, tenant_id: UUID | None) -> None:
    async with AsyncSessionLocal() as db:
        service = ClassificationReviewService(db)
        pending = await service.document_ids_out_of_sync(tenant_id=tenant_id)
        print(f"{len(pending)} document(s) à rattraper.")
        if not apply:
            print("Plan seulement : relancer avec --apply pour écrire.")
            return
        counts = await service.reconcile_document_reviews(tenant_id=tenant_id)
    print(
        f"Revues ouvertes : {counts['opened']}, revues annulées : {counts['cancelled']}."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--apply", action="store_true", help="écrire (sinon plan seulement)"
    )
    parser.add_argument("--tenant", type=UUID, default=None, help="limiter à un tenant")
    args = parser.parse_args()
    asyncio.run(run(args.apply, args.tenant))


if __name__ == "__main__":
    main()
