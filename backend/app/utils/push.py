"""
LifeOS Backend — OneSignal Push Notifications
"""
import urllib.request
import json
import logging
import os
from app.config import get_settings

logger = logging.getLogger("lifeos.push")

def send_push_notification(player_id: str, title: str, message: str, *, data=None, ttl=7200):
    """
    Send a push notification to a specific user via OneSignal.
    """
    settings = get_settings()
    app_id = settings.ONESIGNAL_APP_ID.strip().strip('"').strip("'")
    rest_api_key = settings.ONESIGNAL_REST_API_KEY.strip().strip('"').strip("'")
    
    if not app_id or not rest_api_key:
        logger.warning("OneSignal keys not configured. Skipping push notification.")
        return False, "OneSignal keys not configured in backend"
        
    if not player_id:
        return False, "Missing player_id/device token"
        
    url = "https://api.onesignal.com/notifications"
    
    payload = {
        "app_id": app_id,
        "target_channel": "push",
        "include_subscription_ids": [player_id],
        "headings": {"en": title},
        "contents": {"en": message},
        "priority": 10,
        "ttl": max(0, int(ttl)),
        "data": data or {},
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Key {rest_api_key}"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read())
            if not res_data.get("id"):
                logger.warning("Push rejected: %s", res_data.get("errors", "No recipients"))
                return False, "Phone subscription is no longer active. Open LifeOS, allow notifications and retry."
            logger.info("Push accepted by OneSignal: %s", res_data["id"])
            return True, "Sent"
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        error_msg = str(e)
        if hasattr(e, 'read'):
            error_body = e.read().decode()
            logger.error(f"Error body: {error_body}")
            error_msg = error_body
        return False, error_msg
