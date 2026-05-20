import os
import datetime
from typing import Any

firebase_app = None

def init_firebase():
    global firebase_app
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        if not sa_path:
            return None

        cred = credentials.Certificate(sa_path)
        firebase_app = firebase_admin.initialize_app(cred)
        return firebase_app
    except Exception:
        return None


def send_alert(payload: Any):
    try:
        if firebase_app is None:
            return
        from firebase_admin import firestore

        db = firestore.client()
        doc = {
            "payload": payload,
            "created_at": datetime.datetime.utcnow()
        }
        db.collection("alerts").add(doc)
    except Exception:
        pass
