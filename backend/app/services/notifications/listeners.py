from typing import Dict, Any
from uuid import UUID

from app.core.database import async_session_maker
from app.models.user import User
from app.services.workflow_assignee import active_delegate_ids
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
        # The absent agent keeps their notification; each active stand-in gets
        # one too, otherwise they would not know there is a task (DEC-2026-007).
        delegate_ids = await active_delegate_ids(
            session, UUID(tenant_id), UUID(user_id)
        )
        if not delegate_ids:
            return
        absent = await session.get(User, UUID(user_id))
        absent_name = absent.full_name if absent else ""
        for delegate_id in delegate_ids:
            await notifier.send(
                user_id=str(delegate_id),
                tenant_id=tenant_id,
                event_type="WORKFLOW_ASSIGNED",
                message=(
                    f"Au nom de {absent_name} : valider le document "
                    f"'{document_title}' (Étape: {step_name})"
                ),
                meta_data={**payload, "on_behalf_of": user_id},
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
