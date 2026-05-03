from typing import Dict, Any
from app.core.database import async_session_maker
from app.services.notifications.factory import NotificationFactory
from app.core.events.dispatcher import dispatcher


async def on_workflow_assigned(payload: Dict[str, Any]):
    """
    Listener for when a document enters a new workflow step assigned to a user/org.
    Payload expected:
    - user_id: UUID string
    - tenant_id: UUID string
    - document_title: str
    - step_name: str
    """
    user_id = payload.get("user_id")
    tenant_id = payload.get("tenant_id")
    document_title = payload.get("document_title")
    step_name = payload.get("step_name")

    if not user_id or not tenant_id:
        return

    message = f"Vous avez une nouvelle tâche: valider le document '{document_title}' (Étape: {step_name})"

    notifier = NotificationFactory.get_notifier("in_app")

    # We need a new session context since this runs asynchronously in the background
    async with async_session_maker() as session:
        await notifier.send(
            user_id=user_id,
            tenant_id=tenant_id,
            event_type="WORKFLOW_ASSIGNED",
            message=message,
            meta_data=payload,
            session=session,
        )


async def on_workflow_completed(payload: Dict[str, Any]):
    """
    Listener for when a document completes its entire workflow loop.
    """
    user_id = payload.get("owner_id")
    tenant_id = payload.get("tenant_id")
    document_title = payload.get("document_title")

    if not user_id or not tenant_id:
        return

    message = (
        f"Le workflow pour votre document '{document_title}' a été approuvé et terminé."
    )
    notifier = NotificationFactory.get_notifier("in_app")

    async with async_session_maker() as session:
        await notifier.send(
            user_id=user_id,
            tenant_id=tenant_id,
            event_type="WORKFLOW_COMPLETED",
            message=message,
            meta_data=payload,
            session=session,
        )


def register_all_listeners():
    dispatcher.subscribe("WORKFLOW_ASSIGNED", on_workflow_assigned)
    dispatcher.subscribe("WORKFLOW_COMPLETED", on_workflow_completed)
