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


# @helper_bp.route("/getClusterNames", methods=["GET"])
# def getclusternames():
#     session = db_manager.get_session()

#     existing_clusters = (
#         session.query(
#             ClusterMetrics.cluster_id,
#             ClusterMetrics.cluster_name,
#             ClusterMetrics.user_id,
#         )
#         .filter(ClusterMetrics.cluster_name != "__idle__")
#         .distinct()
#         .all()
#     )

#     # Format as list of dicts
#     cluster_list = [
#         {"id": row.cluster_id, "clusterName": row.cluster_name, "user_id": row.user_id}
#         for row in existing_clusters
#     ]

#     return jsonify(cluster_list), 200


@helper_bp.route("/getClusterNames", methods=["POST"])
def getclusternames():
    session = db_manager.get_session()
    user_id = request.json.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400   

    existing_clusters = (
        session.query(
            ClusterMetrics.cluster_id,
            ClusterMetrics.cluster_name,
            ClusterMetrics.user_id,
        )
        .filter(ClusterMetrics.cluster_name != "__idle__")
        .filter(ClusterMetrics.user_id == user_id)   # ✅ filter by user_id
        .distinct()
        .all()
    )

    # Format as list of dicts
    cluster_list = [
        {"id": row.cluster_id, "clusterName": row.cluster_name, "user_id": row.user_id}
        for row in existing_clusters
    ]

    return jsonify(cluster_list), 200
