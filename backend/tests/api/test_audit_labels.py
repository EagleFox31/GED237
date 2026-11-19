"""The audit journal shows French labels, accents included (#256).

The auditor reads these labels on the journal page and in the CSV export. An action
without a label falls back to its English code ("Document Purged"): every action
written by the application must have one.
"""

import re
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
    "dup_detected": "Doublon refusé",
    "authz_policy_added": "Ajout d'un droit d'accès",
    "authz_policy_removed": "Retrait d'un droit d'accès",
}

ACCENTED_TABLES = {
    "ged_rules": "Règles GED",
    "user_local_arrangement_snapshots": "Bibliothèque locale (compte)",
    "ingest_watch": "Dossiers surveillés",
    "casbin_rule": "Droits d'accès",
}

APP_DIR = Path(__file__).resolve().parents[2] / "app"
# Audit rows name their action with a literal keyword: action="document_purged".
# Authorization checks pass resource and action positionally, so they never match.
WRITTEN_ACTION = re.compile(r"\baction=\"([a-z_]+)\"")


@pytest.mark.parametrize("action, label", sorted(ACCENTED_LABELS.items()))
def test_action_labels_keep_their_accents(action, label):
    assert ACTION_LABELS[action] == label


@pytest.mark.parametrize("table, label", sorted(ACCENTED_TABLES.items()))
def test_table_labels_keep_their_accents(table, label):
    assert TABLE_LABELS[table] == label


def test_every_action_written_by_the_application_has_a_label():
    written = {
        match
        for path in APP_DIR.rglob("*.py")
        for match in WRITTEN_ACTION.findall(path.read_text(encoding="utf-8"))
    }
    assert written, "no audit action found: the pattern no longer matches the code"
    assert sorted(written - ACTION_LABELS.keys()) == []
