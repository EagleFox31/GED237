"""Relance l'OCR de documents choisis par nom de fichier.

    python /app/scripts/reocr.py <nom> [--run]

Sans --run : liste seulement les documents dont le titre contient <nom> (id, titre, nombre de
caractères OCR) ; rien n'est écrit ni mis en file. Avec --run : remet en file la tâche Celery
existante `process_document_ocr` pour chacun, sur sa version la plus récente. À lancer dans le
conteneur worker (ou api), après un OCR tué (SIGKILL) qui laisse un document sans texte.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Callable, Iterable, Sequence

SELECT_SQL = (
    "select d.id, d.title, coalesce(length(d.ocr_content), 0), v.file_path, v.mime_type "
    "from documents d join document_versions v on v.document_id = d.id "
    "where d.title ilike :pattern "
    "order by d.created_at desc, v.version_number desc limit 50"
)


def like_pattern(name: str) -> str:
    """Sous-chaîne littérale : les jokers LIKE du nom (pourcent, souligné) sont échappés."""
    escaped = name.replace("\\", r"\\").replace("%", r"\%").replace("_", r"\_")
    return f"%{escaped}%"


def latest_per_document(rows: Iterable[Sequence]) -> list[Sequence]:
    """Une ligne par document : la première rencontrée (requête triée, version la plus récente)."""
    seen: set = set()
    picked = []
    for row in rows:
        if row[0] in seen:
            continue
        seen.add(row[0])
        picked.append(row)
    return picked


def plan(
    rows: Iterable[Sequence],
    run: bool,
    dispatch: Callable[[str, str, str], str],
    out: Callable[[str], None] = print,
) -> int:
    """Affiche les documents ; ne met en file (dispatch) que si run. Retourne leur nombre."""
    picked = latest_per_document(rows)
    for doc_id, title, chars, file_path, mime in picked:
        out(f"{doc_id} | {title} | ocr_chars={chars}")
        if run:
            out(f"  relance task_id={dispatch(str(doc_id), file_path, mime)}")
    return len(picked)


async def _fetch(name: str) -> list[Sequence]:
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(text(SELECT_SQL), {"pattern": like_pattern(name)})
        return list(result.all())


def _dispatch(doc_id: str, file_path: str, mime: str) -> str:
    from app.workers.tasks import process_document_ocr

    return process_document_ocr.delay(doc_id, file_path, mime).id


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("name", help="sous-chaîne du titre (nom de fichier)")
    parser.add_argument("--run", action="store_true", help="remettre l'OCR en file")
    args = parser.parse_args(argv)
    sys.path.insert(0, "/app")
    count = plan(asyncio.run(_fetch(args.name)), args.run, _dispatch)
    if count == 0:
        print(f"aucun document dont le titre contient « {args.name} »", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
