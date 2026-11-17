"""The review reason reads as proper French, old rows included (D3)."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.classification_reasons import (
    REVIEW_NO_RULE_DOCUMENT,
    REVIEW_REASON_LABELS,
    review_reason_label,
)
from app.models.classification_review import ClassificationReview
from app.models.document import Document
from app.services.classification_review_service import ClassificationReviewService

LEGACY_NO_RULE = "Aucune regle deterministe n a permis de classer ce document."
NO_RULE_LABEL = "Aucune règle de classement ne s'applique à ce document."


def _document(db_seed, title: str) -> Document:
    return Document(
        id=uuid.uuid4(),
        tenant_id=db_seed["tenant_id"],
        org_unit_id=db_seed["org_unit_id"],
        owner_id=db_seed["user_id"],
        title=title,
        file_path=f"tenant/unit/{title}.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=128,
        document_category_id=db_seed["category_id"],
        status="draft",
        processing_mode="archive",
        classification_status="pending",
    )


@pytest.mark.asyncio
async def test_new_and_old_reviews_show_the_accented_reason(
    admin_client: AsyncClient, db_session, db_seed
):
    fresh = _document(db_seed, "sans-regle")
    old = _document(db_seed, "ancienne-revue")
    db_session.add_all([fresh, old])
    await ClassificationReviewService(db_session).ensure_open_review_for_document(
        document=fresh
    )
    # A row written before the fix, with the sentence stored as text.
    db_session.add(
        ClassificationReview(
            tenant_id=db_seed["tenant_id"],
            document_id=old.id,
            review_status="open",
            arbitration_reason=LEGACY_NO_RULE,
        )
    )
    await db_session.commit()

    stored = await db_session.scalar(
        select(ClassificationReview.arbitration_reason).where(
            ClassificationReview.document_id == fresh.id
        )
    )
    assert stored == REVIEW_NO_RULE_DOCUMENT

    response = await admin_client.get("/api/v1/classification-reviews")
    assert response.status_code == 200, response.text
    reasons = {
        item["document"]["id"]: item["arbitration_reason"] for item in response.json()
    }
    assert reasons == {str(fresh.id): NO_RULE_LABEL, str(old.id): NO_RULE_LABEL}


def test_the_label_reads_a_code_an_old_sentence_or_free_text():
    assert review_reason_label(REVIEW_NO_RULE_DOCUMENT) == NO_RULE_LABEL
    assert review_reason_label(LEGACY_NO_RULE) == NO_RULE_LABEL
    assert review_reason_label("Erreur du moteur X") == "Erreur du moteur X"
    assert review_reason_label(None) is None


def test_no_label_is_left_without_accents():
    for label in REVIEW_REASON_LABELS.values():
        assert "regle" not in label and " n a " not in label
        assert any(char in label for char in "éèàï"), label


@pytest.mark.parametrize(
    ("stored", "shown"),
    [
        (
            "Fichier de staging introuvable pour cet item.",
            "Fichier importé introuvable pour cet élément.",
        ),
        (
            "Fichier de staging introuvable pour cet item en attente de revue.",
            "Fichier importé introuvable pour cet élément en attente de revue.",
        ),
        (
            "Un fichier identique existe deja dans ce tenant.",
            "Un fichier identique existe déjà dans l'organisation.",
        ),
    ],
)
def test_old_import_item_messages_are_shown_accented(stored, shown):
    assert review_reason_label(stored) == shown
