"""Relance l'OCR de documents choisis par nom de fichier, ou par type de fichier.

    python /app/scripts/reocr.py <nom> [--tenant <domaine ou id>] [--run]
    python /app/scripts/reocr.py --type word|excel|office [--batch N] [--after <id>]
                                 [--tenant <domaine ou id>] [--run]

Sans --run : liste seulement les documents choisis (id, titre, nombre de caractères OCR) ; rien
n'est écrit ni mis en file. Avec --run : remet en file la tâche Celery existante
`process_document_ocr` pour chacun, sur sa version courante. Les documents en corbeille sont
ignorés. À lancer dans le conteneur worker (ou api).

Par nom : les documents dont le titre contient <nom> (50 au plus), par exemple après un OCR
tué (SIGKILL) qui laisse un document sans texte.

Par type (--type) : rattrapage des fichiers Word ou Excel déposés avant que leur texte soit lu.
Seuls les documents encore sans texte sont choisis, donc une relance après traitement ne
trouve plus rien. Un lot par lancement (--batch, 50 par défaut), dans l'ordre des id ; quand
le lot est plein, la commande affiche le --after du lot suivant. La lecture passe par la même
tâche, avec les mêmes plafonds, et le worker traite un fichier à la fois.

Outil d'exploitation : sans --tenant, il parcourt tous les tenants de la base (l'accès au
conteneur donne déjà accès à toute la base). --tenant limite à un tenant, par son domaine ou son id.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from typing import Callable, Iterable, Sequence

WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
TYPES = {"word": [WORD_MIME], "excel": [EXCEL_MIME], "office": [WORD_MIME, EXCEL_MIME]}
MAX_BATCH = 500

_TENANT_SQL = (
    "(cast(:tenant as text) is null or cast(d.tenant_id as text) = cast(:tenant as text) "
    "or exists (select 1 from tenants t where t.id = d.tenant_id and t.domain = cast(:tenant as text)))"
)

# Une ligne par document, sur sa version courante (current_version_id) : pas de tri sur un
# numéro de version texte. Corbeille exclue. Le type MIME retombe sur celui du document.
SELECT_SQL = (
    "select d.id, d.title, coalesce(length(d.ocr_content), 0), v.file_path, "
    "coalesce(v.mime_type, d.mime_type) "
    "from documents d join document_versions v on v.id = d.current_version_id "
    "where d.deleted_at is null and d.title ilike :pattern "
    f"and {_TENANT_SQL} "
    "order by d.created_at desc limit 50"
)

# Rattrapage par type : documents sans texte, version courante du type demandé, par id
# croissant à partir du curseur (stable même si des documents sont ajoutés entre deux lots).
SELECT_BY_TYPE_SQL = (
    "select d.id, d.title, coalesce(length(d.ocr_content), 0), v.file_path, "
    "coalesce(v.mime_type, d.mime_type) "
    "from documents d join document_versions v on v.id = d.current_version_id "
    "where d.deleted_at is null and coalesce(length(d.ocr_content), 0) = 0 "
    "and coalesce(v.mime_type, d.mime_type) = any(:mimes) "
    "and (cast(:after as uuid) is null or d.id > cast(:after as uuid)) "
    f"and {_TENANT_SQL} "
    "order by d.id limit :batch"
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


def type_params(kind: str, batch: int, after: str | None, tenant: str | None) -> dict:
    """Paramètres de SELECT_BY_TYPE_SQL ; lève ValueError sur un lot ou un curseur invalide."""
    if not 1 <= batch <= MAX_BATCH:
        raise ValueError(f"--batch doit être entre 1 et {MAX_BATCH}")
    return {
        "mimes": TYPES[kind],
        "batch": batch,
        "after": uuid.UUID(after) if after else None,
        "tenant": tenant,
    }


def next_cursor(rows: Sequence[Sequence], batch: int) -> str | None:
    """Id à passer en --after pour le lot suivant, ou None si ce lot était le dernier."""
    return str(rows[-1][0]) if len(rows) == batch else None


async def _fetch(sql: str, params: dict) -> list[Sequence]:
    from sqlalchemy import text

    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        result = await db.execute(text(sql), params)
        return list(result.all())


def _dispatch(doc_id: str, file_path: str, mime: str) -> str:
    from app.workers.tasks import process_document_ocr

    return process_document_ocr.delay(doc_id, file_path, mime).id


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("name", nargs="?", help="sous-chaîne du titre (nom de fichier)")
    parser.add_argument(
        "--type", choices=sorted(TYPES), help="rattrapage par type, au lieu d'un nom"
    )
    parser.add_argument("--batch", type=int, default=50, help="taille du lot (--type)")
    parser.add_argument(
        "--after", help="id du dernier document du lot précédent (--type)"
    )
    parser.add_argument("--tenant", help="limiter à un tenant (domaine ou id)")
    parser.add_argument("--run", action="store_true", help="remettre l'OCR en file")
    args = parser.parse_args(argv)
    if (args.name is None) == (args.type is None):
        parser.error("donner soit un nom, soit --type")
    sys.path.insert(0, "/app")

    if args.name is not None:
        params = {"pattern": like_pattern(args.name), "tenant": args.tenant}
        count = plan(asyncio.run(_fetch(SELECT_SQL, params)), args.run, _dispatch)
        if count == 0:
            print(
                f"aucun document dont le titre contient « {args.name} »",
                file=sys.stderr,
            )
            return 1
        return 0

    try:
        params = type_params(args.type, args.batch, args.after, args.tenant)
    except ValueError as exc:
        parser.error(str(exc))
    rows = asyncio.run(_fetch(SELECT_BY_TYPE_SQL, params))
    count = plan(rows, args.run, _dispatch)
    cursor = next_cursor(rows, args.batch)
    print(f"{count} document(s) {args.type} sans texte dans ce lot")
    if cursor:
        print(f"lot suivant : --type {args.type} --after {cursor}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
