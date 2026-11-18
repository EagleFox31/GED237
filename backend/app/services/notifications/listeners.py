import logging
from typing import Dict, Any

from app.core.database import async_session_maker
from app.services.notifications.factory import NotificationFactory
from app.core.events.dispatcher import dispatcher

logger = logging.getLogger(__name__)


async def _notify(
    *,
    user_id: str | None,
    tenant_id: str | None,
    event_type: str,
    message: str,
    payload: Dict[str, Any],
) -> None:
    """Persist the in-app notification.

    The live WebSocket push is done by the in-app notifier itself once the row is
    committed (realtime.push_notification, PR #155), with the same shape as an item
    of GET /notifications/. Pushing again here would send it twice, without its id.
    """
    if not user_id or not tenant_id:
        return
    # The depositor acting on their own document needs no notification.
    if payload.get("actor_id") and str(payload["actor_id"]) == str(user_id):
        return

    notifier = NotificationFactory.get_notifier("in_app")

    # We need a new session context since this runs asynchronously in the background
    async with async_session_maker() as session:
        saved = await notifier.send(
            user_id=user_id,
            tenant_id=tenant_id,
            event_type=event_type,
            message=message,
            meta_data=payload,
            session=session,
        )
    if not saved:
        logger.warning("%s notification for %s was not saved", event_type, user_id)


REASON_MAX_LENGTH = 200


def with_reason(message: str, comment: str | None) -> str:
    """Append the reviewer's reason, trimmed so the notification stays one line."""
    reason = " ".join((comment or "").split())
    if not reason:
        return message
    if len(reason) > REASON_MAX_LENGTH:
        reason = reason[: REASON_MAX_LENGTH - 1] + "…"
    return f"{message} Motif : {reason}"


async def on_workflow_assigned(payload: Dict[str, Any]):
    """
    Listener for when a document enters a new workflow step assigned to a user/org.
    Payload expected:
    - user_id: UUID string
    - tenant_id: UUID string
    - document_title: str
    - step_name: str
    """
    document_title = payload.get("document_title")
    step_name = payload.get("step_name")
    await _notify(
        user_id=payload.get("user_id"),
        tenant_id=payload.get("tenant_id"),
        event_type="WORKFLOW_ASSIGNED",
        message=(
            f"Vous avez une nouvelle tâche: valider le document '{document_title}' "
            f"(Étape: {step_name})"
        ),
        payload=payload,
    )


async def on_workflow_completed(payload: Dict[str, Any]):
    """The whole workflow is approved: tell the depositor."""
    await _notify(
        user_id=payload.get("owner_id"),
        tenant_id=payload.get("tenant_id"),
        event_type="WORKFLOW_COMPLETED",
        message=(
            f"Le workflow pour votre document '{payload.get('document_title')}' "
            "a été approuvé et terminé."
        ),
        payload=payload,
    )


async def on_workflow_step_accepted(payload: Dict[str, Any]):
    """One step is visaed and the next one starts: tell the depositor."""
    await _notify(
        user_id=payload.get("owner_id"),
        tenant_id=payload.get("tenant_id"),
        event_type="WORKFLOW_STEP_ACCEPTED",
        message=(
            f"Votre document '{payload.get('document_title')}' a reçu un visa "
            f"(étape: {payload.get('step_name')})."
        ),
        payload=payload,
    )


async def on_workflow_rejected(payload: Dict[str, Any]):
    """A step rejects the document: tell the depositor."""
    await _notify(
        user_id=payload.get("owner_id"),
        tenant_id=payload.get("tenant_id"),
        event_type="WORKFLOW_REJECTED",
        message=with_reason(
            f"Votre document '{payload.get('document_title')}' a été rejeté "
            f"(étape: {payload.get('step_name')}).",
            payload.get("comment"),
        ),
        payload=payload,
    )


async def on_workflow_returned(payload: Dict[str, Any]):
    """A step returns the document for correction: tell the depositor."""
    await _notify(
        user_id=payload.get("owner_id"),
        tenant_id=payload.get("tenant_id"),
        event_type="WORKFLOW_RETURNED",
        message=with_reason(
            f"Votre document '{payload.get('document_title')}' vous est retourné "
            f"pour correction (étape: {payload.get('step_name')}).",
            payload.get("comment"),
        ),
        payload=payload,
    )


def register_all_listeners():
    dispatcher.subscribe("WORKFLOW_ASSIGNED", on_workflow_assigned)
    dispatcher.subscribe("WORKFLOW_COMPLETED", on_workflow_completed)
    dispatcher.subscribe("WORKFLOW_STEP_ACCEPTED", on_workflow_step_accepted)
    dispatcher.subscribe("WORKFLOW_REJECTED", on_workflow_rejected)
    dispatcher.subscribe("WORKFLOW_RETURNED", on_workflow_returned)
