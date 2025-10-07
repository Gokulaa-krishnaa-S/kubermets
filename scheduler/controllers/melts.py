# controller.py
import os
import requests
from dotenv import load_dotenv
from flask import request

load_dotenv()

# Configurable API base URL (pointing to the other Flask app)
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")


def setMelts():
    """
    Controller: Send MELTS data to the external melts API we created earlier.
    """
    try:
        # Parse JSON request body
        bluePrintsMeltsData = request.get_json()
        cluster_id = bluePrintsMeltsData.get("cluster_id")
        user_id = bluePrintsMeltsData.get("user_id")
        payload = bluePrintsMeltsData.get("payload")

        if not cluster_id:
            raise ValueError("cluster_id is required")

        # Prepare body for external API
        body = {
            "cluster_id": cluster_id,
            "user_id": user_id,
            "payload": payload
        }

        # Send POST request to external API
        response = requests.post(f"{BACKEND_API_URL}/v1/setMeltsData", json=body)
        response.raise_for_status()

        return response.json()

    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to send melts data: {str(e)}"}
    except Exception as e:
        return {"error": str(e)}
