"""Why a document or an imported file waits in the classification review (D3).

The review stores a stable code; the French label is computed when it is read, so a wording
fix reaches every row without rewriting the table. Rows written before the codes hold the old
unaccented sentences: they are translated on read too. Any other text (an engine message we
do not know) is shown as stored.
"""

from typing import Annotated, Optional

from pydantic import AfterValidator

REVIEW_AMBIGUOUS = "ambiguous_target"
REVIEW_NO_RULE_DOCUMENT = "no_rule_document"
REVIEW_NO_RULE_IMPORT_ITEM = "no_rule_import_item"

REVIEW_REASON_LABELS = {
    REVIEW_AMBIGUOUS: "Le moteur de classement a détecté une ambiguïté ou une cible à vérifier.",
    REVIEW_NO_RULE_DOCUMENT: "Aucune règle de classement ne s'applique à ce document.",
    REVIEW_NO_RULE_IMPORT_ITEM: "Aucune règle de classement ne s'applique à ce fichier importé.",
}

MULTIPLE_RULES_MESSAGE = (
    "Plusieurs règles de même priorité correspondent. Revue manuelle requise."
)
NO_VALID_SPACE_MESSAGE = (
    "La règle correspondante ne permet pas de construire un espace logique valide."
)
UNSUPPORTED_IMPORT_FORMAT_MESSAGE = "Format non pris en charge par l'import de masse."
DUPLICATE_IN_TENANT_MESSAGE = "Un fichier identique existe déjà dans l'organisation."
DUPLICATE_IN_IMPORT_MESSAGE = (
    "Ce fichier est présent plusieurs fois dans le même import."
)
STAGED_FILE_MISSING_MESSAGE = (
    "Fichier importé introuvable pour cet élément en attente de revue."
)
STAGED_FILE_LOST_MESSAGE = "Fichier importé introuvable pour cet élément."

# Sentences stored before D3, exactly as written then: existing rows keep them.
_LEGACY_TEXTS = {
    "Le moteur de classement a detecte une ambiguite ou une cible a verifier.": REVIEW_REASON_LABELS[
        REVIEW_AMBIGUOUS
    ],
    "Aucune regle deterministe n a permis de classer ce document.": REVIEW_REASON_LABELS[
        REVIEW_NO_RULE_DOCUMENT
    ],
    "Aucune regle deterministe n a permis de classer ce fichier du batch.": REVIEW_REASON_LABELS[
        REVIEW_NO_RULE_IMPORT_ITEM
    ],
    "Plusieurs regles de meme priorite correspondent. Revue manuelle requise.": MULTIPLE_RULES_MESSAGE,
    "La regle correspondante ne permet pas de construire un espace logique valide.": NO_VALID_SPACE_MESSAGE,
    "Format non supporte par l'import de masse.": UNSUPPORTED_IMPORT_FORMAT_MESSAGE,
    "Un fichier identique existe deja dans ce tenant.": DUPLICATE_IN_TENANT_MESSAGE,
    "Ce fichier est present plusieurs fois dans le meme batch.": DUPLICATE_IN_IMPORT_MESSAGE,
    "Fichier de staging introuvable pour cet item en attente de revue.": STAGED_FILE_MISSING_MESSAGE,
    "Fichier de staging introuvable pour cet item.": STAGED_FILE_LOST_MESSAGE,
}


def review_reason_label(stored: Optional[str]) -> Optional[str]:
    """The sentence shown for a stored reason: code, legacy sentence or free text."""
    if stored is None:
        return None
    return REVIEW_REASON_LABELS.get(stored) or _LEGACY_TEXTS.get(stored) or stored


# Schema field type: whatever the row holds, the API sends the readable sentence.
ReviewReasonText = Annotated[Optional[str], AfterValidator(review_reason_label)]
