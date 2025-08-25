from flask import Blueprint, jsonify, request
from models.model import NodeMetrics, db_manager
from sqlalchemy import func
from datetime import datetime, timedelta

nodes_bp = Blueprint("nodes", __name__, url_prefix="/v1/nodes")

@nodes_bp.route("/", methods=["GET"])
def get_node_metrics():
    """
    Fetch node metrics by cluster_id with optional time window duration
    Params:
      cluster_id (required)
      duration: 24h, 3d, 7d, 1m, 6m (default: 24h)
    """
    print("=== Fetching node metrics ===")
    session = db_manager.get_session()
    try:
        # 1️⃣ Get cluster_id from request
        cluster_id = request.args.get("cluster_id")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        # 2️⃣ Get duration (default: 24h)
        duration = request.args.get("duration", "24h")

        # Convert duration into datetime filter
        end_time = datetime.utcnow()
        if duration.endswith("h"):
            hours = int(duration[:-1])
            start_time = end_time - timedelta(hours=hours)
        elif duration.endswith("d"):
            days = int(duration[:-1])
            start_time = end_time - timedelta(days=days)
        elif duration.endswith("m"):  # months → approx 30 days each
            months = int(duration[:-1])
            start_time = end_time - timedelta(days=months * 30)
        else:
            return jsonify({"error": "Invalid duration format"}), 400


        print(start_time , "---START TIME------" , end_time)

        # 3️⃣ Build query: sum numeric fields, group by node_name
        query = session.query(
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
            func.max(NodeMetrics.updated_at).label("updated_at")
        ).filter(
            NodeMetrics.cluster_id == cluster_id,
            NodeMetrics.timestamp >= start_time,
            NodeMetrics.timestamp <= end_time
        ).group_by(NodeMetrics.node_name)

        # 4️⃣ Execute query
        results = query.all()

        # 5️⃣ Format response as list of dicts
        data = []
        for row in results:
            data.append({col: getattr(row, col) for col in row._fields})

        return jsonify({
            "cluster_id": cluster_id,
            "duration": duration,
            "data": data,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat()
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()