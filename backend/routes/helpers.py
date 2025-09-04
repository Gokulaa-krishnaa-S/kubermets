from flask import Blueprint, jsonify, request
from models.model import NodeMetrics, db_manager
from sqlalchemy import func
from datetime import datetime, timedelta

helper_bp = Blueprint("helper", __name__, url_prefix="/v1")

@helper_bp.route("/get_namespaces", methods=["GET"])
def get_namespaces():
    session = db_manager.get_session()
    rows = (
        session.query(NodeMetrics)
        .distinct('namespace')
        .all()
    )
    return rows