import requests
from flask import Blueprint, jsonify
import os

from dotenv import load_dotenv


melts_bp = Blueprint("melts", __name__, url_prefix="/v1")

load_dotenv()

# Configurable API base URL (pointing to the other Flask app we built earlier)
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")

def setMetls(bluePrintsMeltsData: dict) -> dict:
    """
    Send MELTS data to the external melts API we created earlier.
    """
    try:
        # Extract fields (make sure input dict has required fields)
        cluster_id = bluePrintsMeltsData.get("cluster_id")
        user_id = bluePrintsMeltsData.get("user_id")
        payload = bluePrintsMeltsData.get("payload")

        if not cluster_id:
            raise ValueError("cluster_id is required")

        # Build request body
        body = {
            "cluster_id": cluster_id,
            "user_id": user_id,
            "payload": payload
        }

        # Call the external API
        response = requests.post(f"{MELTS_API_BASE_URL}/setMeltsData", json=body)

        # Raise error if failed
        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to send melts data: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}
