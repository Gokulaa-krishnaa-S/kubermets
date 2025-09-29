from flask import Blueprint, jsonify, request
from models.model import db_manager
from controllers.melts_controller import set_melts_data

melts_bp = Blueprint("melts", __name__, url_prefix="/v1")

@melts_bp.route("/setMeltsData", methods=["POST"])
def setMeltsData():
    session = db_manager.get_session()
    try:
        body = request.get_json()

        cluster_id = body.get("cluster_id")
        user_id = body.get("user_id")
        payload = body.get("payload")

        result = set_melts_data(
            session=session,
            cluster_id=cluster_id,
            user_id=user_id,
            payload=payload
        )

        return jsonify(result), 201

    except ValueError as e:
        session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
