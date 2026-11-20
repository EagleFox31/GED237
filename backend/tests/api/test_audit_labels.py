"""The audit journal shows French labels, accents included (#256).

The auditor reads these labels on the journal page and in the CSV export. An action
without a label falls back to its English code ("Document Purged"): every action
written by the application must have one.
"""

import ast
from pathlib import Path

import pytest

from app.api.v1.endpoints.audit import ACTION_LABELS, TABLE_LABELS

ACCENTED_LABELS = {
    "account_locked": "Compte verrouillé",
    "create": "Création",
    "upload": "Dépôt de document",
    "login_failed": "Connexion refusée",
    "import_committed": "Import exécuté",
    "review_resolved": "Arbitrage de classement validé",
    "workflow_started": "Circuit déclenché",
    "workflow_step_completed": "Étape de workflow traitée",
    "unlock": "Déverrouillage",
    "document_trashed": "Mise à la corbeille",
    "document_purged": "Suppression définitive",
    "workflow_started_a_posteriori": "Circuit déclenché a posteriori",
    "local_snap_put": "Bibliothèque locale (sync)",
    "totp_reset": "Application d'authentification réinitialisée",
    "totp_disabled": "Application d'authentification désactivée",
    "dup_detected": "Doublon refusé",
    "otp_sent": "Code de connexion envoyé",
    "otp_send_failed": "Échec d'envoi du code",
}

ACCENTED_TABLES = {
    "ged_rules": "Règles GED",
    "user_local_arrangement_snapshots": "Bibliothèque locale (compte)",
    "ingest_watch": "Dossiers surveillés",
}

APP_DIR = Path(__file__).resolve().parents[2] / "app"


def _literals(node: ast.expr) -> set[str]:
    """String values an ``action=`` argument can take: a literal, or both
    branches of a conditional (action="otp_sent" if ok else "otp_send_failed")."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return {node.value}
    if isinstance(node, ast.IfExp):
        return _literals(node.body) | _literals(node.orelse)
    return set()


def _written_actions(source: str) -> set[str]:
    """Audit rows name their action with a keyword: action="document_purged".
    Authorization checks pass resource and action positionally, so they never
    match; argparse's add_argument(action="store_true") is not an audit row."""
    found: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Attribute) and node.func.attr == "add_argument":
            continue
        for keyword in node.keywords:
            if keyword.arg == "action":
                found |= _literals(keyword.value)
    return found


@pytest.mark.parametrize("action, label", sorted(ACCENTED_LABELS.items()))
def test_action_labels_keep_their_accents(action, label):
    assert ACTION_LABELS[action] == label


@pytest.mark.parametrize("table, label", sorted(ACCENTED_TABLES.items()))
def test_table_labels_keep_their_accents(table, label):
    assert TABLE_LABELS[table] == label


def test_every_action_written_by_the_application_has_a_label():
    written = {
        action
        for path in APP_DIR.rglob("*.py")
        for action in _written_actions(path.read_text(encoding="utf-8"))
    }
    assert written, "no audit action found: the pattern no longer matches the code"
    assert sorted(written - ACTION_LABELS.keys()) == []
