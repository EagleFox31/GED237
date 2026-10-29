from app.services.notifications.base import INotifier
from app.services.notifications.in_app import InAppNotifier


class NotificationFactory:
    """
    Factory to retrieve the appropriate notifier based on the channel name.
    """

    @staticmethod
    def get_notifier(channel: str = "in_app") -> INotifier:
        if channel == "in_app":
            return InAppNotifier()
        # elif channel == "email":
        #    return EmailNotifier()
        # elif channel == "sms":
        #    return SmsNotifier()
        else:
            raise ValueError(f"Unknown notification channel: {channel}")
