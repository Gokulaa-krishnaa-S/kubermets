from flask import Blueprint, jsonify, request
from models.model import NodeMetrics, db_manager, PodMetrics, ClusterMetrics
# from cluster import get_cluster_data
from sqlalchemy import func

helper_bp = Blueprint("helper", __name__, url_prefix="/v1")


@helper_bp.route("/get_filter_params", methods=["GET"])
def get_filter_params():
    metric_type = request.args.get("type", "node")  # node / pod
    metric = request.args.get("metric", "namespace")  # namespace, node_name, etc.
    session = db_manager.get_session()
    try:
        if metric_type == "node":
            model = NodeMetrics
        elif metric_type == "pod":
            model = PodMetrics
        else:
            return jsonify({"error": "Invalid type. Use 'node' or 'pod'."}), 400

        # Check if the column exists in the model
        if not hasattr(model, metric):
            return (
                jsonify({"error": f"Invalid metric '{metric}' for {metric_type}"}),
                400,
            )

        column = getattr(model, metric)
        results = session.query(column).distinct().all()
        values = [r[0] for r in results]

        return jsonify(values)
    finally:
        session.close()


@helper_bp.route("/getClusterNames", methods=["GET"])
def getclusternames():
    session = db_manager.get_session()

    existing_cluster_names = session.query(
        func.distinct(ClusterMetrics.cluster_name)
    ).all()

    print(existing_cluster_names)

    cluster_names = [row[0] for row in existing_cluster_names]

    return jsonify(cluster_names), 200