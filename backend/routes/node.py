from flask import Blueprint, jsonify, request
from models.model import NodeMetrics, db_manager
from sqlalchemy import func
from datetime import datetime, timedelta

nodes_bp = Blueprint("nodes", __name__, url_prefix="/v1/nodes")


def parse_duration(duration: str, end_time=None):
    end_time = end_time or datetime.utcnow()
    if duration.endswith("h"):
        start_time = end_time - timedelta(hours=int(duration[:-1]))
    elif duration.endswith("d"):
        start_time = end_time - timedelta(days=int(duration[:-1]))
    elif duration.endswith("m"):
        start_time = end_time - timedelta(days=int(duration[:-1]) * 30)
    else:
        raise ValueError("Invalid duration format")
    return start_time, end_time


# Build dynamic query for any model + fields
def build_metrics_query(session, model, filters, group_by_fields, aggregates):
    query = session.query(*aggregates).filter(*filters)
    if group_by_fields:
        query = query.group_by(*group_by_fields)
    return query


NODE_AGGREGATES = [
    NodeMetrics.node_name,
    func.sum(NodeMetrics.total_cost).label("total_cost"),
    func.sum(NodeMetrics.cpu_cost).label("cpu_cost"),
    func.sum(NodeMetrics.cpu_cost_idle).label("cpu_cost_idle"),
    func.sum(NodeMetrics.ram_cost).label("ram_cost"),
    func.sum(NodeMetrics.ram_cost_idle).label("ram_cost_idle"),
    func.sum(NodeMetrics.pv_cost).label("pv_cost"),
    func.sum(NodeMetrics.network_cost).label("network_cost"),
    func.sum(NodeMetrics.gpu_cost).label("gpu_cost"),
    func.sum(NodeMetrics.gpu_cost_idle).label("gpu_cost_idle"),
    func.sum(NodeMetrics.load_balancer_cost).label("load_balancer_cost"),
    func.sum(NodeMetrics.external_cost).label("external_cost"),
    func.sum(NodeMetrics.shared_cost).label("shared_cost"),
    func.sum(NodeMetrics.cpu_core_request_average).label("cpu_core_request_average"),
    func.sum(NodeMetrics.cpu_core_usage_average).label("cpu_core_usage_average"),
    func.sum(NodeMetrics.ram_byte_request_average).label("ram_byte_request_average"),
    func.sum(NodeMetrics.ram_byte_usage_average).label("ram_byte_usage_average"),
    func.sum(NodeMetrics.gpu_request_average).label("gpu_request_average"),
    func.sum(NodeMetrics.gpu_usage_average).label("gpu_usage_average"),
    func.avg(NodeMetrics.total_efficiency).label("total_efficiency"),
    func.avg(NodeMetrics.cpu_usage_percent).label("cpu_usage_percent"),
    func.avg(NodeMetrics.memory_usage_percent).label("memory_usage_percent"),
    func.avg(NodeMetrics.memory_gb_used).label("memory_gb_used"),
    func.avg(NodeMetrics.memory_gb_requested).label("memory_gb_requested"),
    func.avg(NodeMetrics.efficiency_percent).label("efficiency_percent"),
    func.max(NodeMetrics.node_status).label("node_status"),
    func.avg(NodeMetrics.node_health_score).label("node_health_score"),
    func.max(NodeMetrics.node_instance_type).label("node_instance_type"),
    func.max(NodeMetrics.node_zone).label("node_zone"),
    func.bool_or(NodeMetrics.is_idle_allocation).label("is_idle_allocation"),
    func.bool_or(NodeMetrics.is_unallocated).label("is_unallocated"),
    func.bool_or(NodeMetrics.is_system_allocation).label("is_system_allocation"),
    func.min(NodeMetrics.first_seen).label("first_seen"),
    func.max(NodeMetrics.last_seen).label("last_seen"),
    func.bool_or(NodeMetrics.is_active).label("is_active"),
    func.min(NodeMetrics.created_at).label("created_at"),
    func.max(NodeMetrics.updated_at).label("updated_at"),
]

NODE_GROUP_BY = [NodeMetrics.node_name]


def get_node_data(
    session, model, cluster_id, user_id, duration, aggregates, group_by_fields
):
    start_time, end_time = parse_duration(duration)

    filters = [
        model.user_id == user_id,
        model.cluster_id == cluster_id,
        model.timestamp >= start_time,
        model.timestamp <= end_time,
    ]

    query = build_metrics_query(session, model, filters, group_by_fields, aggregates)
    results = query.all()

    data = [dict(zip(row._fields, row)) for row in results]

    return {
        "cluster_id": cluster_id,
        "duration": duration,
        "data": data,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
    }


@nodes_bp.route("/", methods=["GET"])
def get_node_metrics():
    session = db_manager.get_session()
    try:
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        duration = request.args.get("duration", "24h")

        result = get_node_data(
            session=session,
            model=NodeMetrics,
            cluster_id=cluster_id,
            user_id=user_id,
            duration=duration,
            aggregates=NODE_AGGREGATES,
            group_by_fields=NODE_GROUP_BY,
        )

        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
