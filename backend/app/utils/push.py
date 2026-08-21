"""
LifeOS Backend — OneSignal Push Notifications
"""
import urllib.request
import json
import logging
import os
from app.config import get_settings

logger = logging.getLogger("lifeos.push")

def send_push_notification(player_id: str, title: str, message: str):
    """
    Send a push notification to a specific user via OneSignal.
    """
    settings = get_settings()
    app_id = settings.ONESIGNAL_APP_ID
    rest_api_key = settings.ONESIGNAL_REST_API_KEY
    
    if not app_id or not rest_api_key:
        logger.warning("OneSignal keys not configured. Skipping push notification.")
        return False, "OneSignal keys not configured in backend"
        
    if not player_id:
        return False, "Missing player_id/device token"
        
    url = "https://onesignal.com/api/v1/notifications"
    
    payload = {
        "app_id": app_id,
        "target_channel": "push",
        "include_subscription_ids": [player_id],
        "headings": {"en": title},
        "contents": {"en": message},
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
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read())
            logger.info(f"Push notification sent successfully: {res_data}")
            return True, "Sent"
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        error_msg = str(e)
        if hasattr(e, 'read'):
            error_body = e.read().decode()
            logger.error(f"Error body: {error_body}")
            error_msg = error_body
        return False, error_msg
