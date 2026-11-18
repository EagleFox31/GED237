"""Relance l'OCR de documents choisis par nom de fichier.

    python /app/scripts/reocr.py <nom> [--tenant <domaine ou id>] [--run]

Sans --run : liste seulement les documents dont le titre contient <nom> (id, titre, nombre de
caractères OCR) ; rien n'est écrit ni mis en file. Avec --run : remet en file la tâche Celery
existante `process_document_ocr` pour chacun, sur sa version courante. Les documents en corbeille
sont ignorés. À lancer dans le conteneur worker (ou api), après un OCR tué (SIGKILL) qui laisse
un document sans texte.

Outil d'exploitation : sans --tenant, il parcourt tous les tenants de la base (l'accès au
conteneur donne déjà accès à toute la base). --tenant limite à un tenant, par son domaine ou son id.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Callable, Iterable, Sequence

# Une ligne par document, sur sa version courante (current_version_id) : pas de tri sur un
# numéro de version texte. Corbeille exclue. Le type MIME retombe sur celui du document.
SELECT_SQL = (
    "select d.id, d.title, coalesce(length(d.ocr_content), 0), v.file_path, "
    "coalesce(v.mime_type, d.mime_type) "
    "from documents d join document_versions v on v.id = d.current_version_id "
    "where d.deleted_at is null and d.title ilike :pattern "
    "and (cast(:tenant as text) is null or cast(d.tenant_id as text) = cast(:tenant as text) "
    "or exists (select 1 from tenants t where t.id = d.tenant_id and t.domain = cast(:tenant as text))) "
    "order by d.created_at desc limit 50"
)


def like_pattern(name: str) -> str:
    """Sous-chaîne littérale : les jokers LIKE du nom (pourcent, souligné) sont échappés."""
    escaped = name.replace("\\", r"\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"


def plan(
    rows: Iterable[Sequence],
    run: bool,
    dispatch: Callable[[str, str, str], str],
    out: Callable[[str], None] = print,
) -> int:
    """Affiche les documents ; ne met en file (dispatch) que si run. Retourne leur nombre."""
    count = 0
    for doc_id, title, chars, file_path, mime in rows:
        count += 1
        out(f"{doc_id} | {title} | ocr_chars={chars}")
        if run:
            out(f"  relance task_id={dispatch(str(doc_id), file_path, mime)}")
    return count


async def _fetch(name: str, tenant: str | None) -> list[Sequence]:
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text(SELECT_SQL), {"pattern": like_pattern(name), "tenant": tenant}
        )
        return list(result.all())


def _dispatch(doc_id: str, file_path: str, mime: str) -> str:
    from app.workers.tasks import process_document_ocr

    return process_document_ocr.delay(doc_id, file_path, mime).id


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("name", help="sous-chaîne du titre (nom de fichier)")
    parser.add_argument("--tenant", help="limiter à un tenant (domaine ou id)")
    parser.add_argument("--run", action="store_true", help="remettre l'OCR en file")
    args = parser.parse_args(argv)
    sys.path.insert(0, "/app")
    count = plan(asyncio.run(_fetch(args.name, args.tenant)), args.run, _dispatch)
    if count == 0:
        print(f"aucun document dont le titre contient « {args.name} »", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
