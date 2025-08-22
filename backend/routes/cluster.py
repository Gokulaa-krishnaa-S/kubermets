from flask import Blueprint, jsonify, Response, request
from models.model import ClusterMetrics, NodeMetrics, PodMetrics
from models.model import db_manager
from sqlalchemy import desc, asc
from datetime import datetime, timedelta
import os
from service.data_service import generate_uuid


UPLOAD_FOLDER = "uploads/providers"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
clusters_bp = Blueprint("clusters", __name__, url_prefix="/v1")


@clusters_bp.route("/")
def index():
    return Response("Kubecost Monitoring API v1.0", status=200)


@clusters_bp.route("/health")
def health():
    return Response("OK", status=200)


# ================================
# GET Endpoints for Metrics
# ================================


@clusters_bp.route("/clusters", methods=["GET"])
def get_cluster_metrics():
    """
    Get cluster metrics with optional filtering
    """
    print("=== Flask Route /clusters Hit ===")
    print("Request method:", request.method)
    print("Request URL:", request.url)
    print("Request args:", dict(request.args))
    print("Request headers:", dict(request.headers))

    try:
        # Get query parameters
        cluster_name = request.args.get("cluster_name")
        window_duration = request.args.get("window_duration", "1h")  # Default to 1h
        limit = request.args.get("limit", 100, type=int)
        offset = request.args.get("offset", 0, type=int)
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")

        print("Parsed parameters:")
        print(f"  - cluster_name: {cluster_name}")
        print(f"  - window_duration: {window_duration}")
        print(f"  - limit: {limit}")
        print(f"  - offset: {offset}")
        print(f"  - start_date: {start_date}")
        print(f"  - end_date: {end_date}")

        # Build filters dictionary
        filters = {}
        if cluster_name:
            filters["cluster_name"] = cluster_name
        if start_date:
            filters["start_date"] = start_date
        if end_date:
            filters["end_date"] = end_date

        print("Filters to apply:", filters)

        # Call your database service/function here
        # Replace this with your actual database call
        cluster_metrics = fetch_cluster_metrics_from_db(
            filters=filters, window_duration=window_duration, limit=limit, offset=offset
        )

        print(f"Retrieved {len(cluster_metrics)} cluster metrics from database")

        # Format response
        response_data = {
            "data": cluster_metrics,
            "total": len(cluster_metrics),
            "limit": limit,
            "offset": offset,
            "filters_applied": filters,
        }

        print("Returning response with data count:", len(cluster_metrics))
        return jsonify(response_data), 200

    except Exception as e:
        print(f"Error in get_cluster_metrics: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback

        print("Full traceback:")
        traceback.print_exc()

        return (
            jsonify({"error": "Failed to fetch cluster metrics", "message": str(e)}),
            500,
        )


# Helper function - replace with your actual database query
def fetch_cluster_metrics_from_db(filters, window_duration, limit, offset):
    """
    Replace this with your actual database query logic
    """
    print(f"=== Database Query ===")
    print(f"Filters: {filters}")
    print(f"Window Duration: {window_duration}")
    print(f"Limit: {limit}, Offset: {offset}")

    # Your database query logic here
    # Example:
    # query = db.session.query(ClusterMetric)
    # if 'cluster_name' in filters:
    #     query = query.filter(ClusterMetric.cluster_name == filters['cluster_name'])
    # if 'start_date' in filters:
    #     query = query.filter(ClusterMetric.timestamp >= filters['start_date'])
    # if 'end_date' in filters:
    #     query = query.filter(ClusterMetric.timestamp <= filters['end_date'])
    #
    # results = query.limit(limit).offset(offset).all()
    # return [result.to_dict() for result in results]

    # For now, return empty list - replace with your actual implementation
    return []


@clusters_bp.route("/nodes", methods=["GET"])
def get_node_metrics():
    """
    Get node metrics with optional filtering
    Query params: node_name, cluster_name, window_duration, limit, offset, start_date, end_date
    """
    session = db_manager.get_session()
    try:
        query = session.query(NodeMetrics)

        # Apply filters
        node_name = request.args.get("node_name")
        if node_name:
            query = query.filter(NodeMetrics.node_name == node_name)

        cluster_name = request.args.get("cluster_name")
        if cluster_name:
            query = query.filter(NodeMetrics.cluster_name == cluster_name)

        window_duration = request.args.get("window_duration")
        if window_duration:
            query = query.filter(NodeMetrics.window_duration == window_duration)

        start_date = request.args.get("start_date")
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(NodeMetrics.timestamp >= start_date)

        end_date = request.args.get("end_date")
        if end_date:
            end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(NodeMetrics.timestamp <= end_date)

        # Pagination
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))

        # Order by timestamp desc
        query = query.order_by(desc(NodeMetrics.timestamp))

        total_count = query.count()
        metrics = query.limit(limit).offset(offset).all()

        result = []
        for metric in metrics:
            result.append(
                {
                    "id": metric.id,
                    "node_name": metric.node_name,
                    "cluster_name": metric.cluster_name,
                    "timestamp": (
                        metric.timestamp.isoformat() if metric.timestamp else None
                    ),
                    "window_start": (
                        metric.window_start.isoformat() if metric.window_start else None
                    ),
                    "window_end": (
                        metric.window_end.isoformat() if metric.window_end else None
                    ),
                    "window_duration": metric.window_duration,
                    "total_cost": metric.total_cost,
                    "cpu_cost": metric.cpu_cost,
                    "ram_cost": metric.ram_cost,
                    "cpu_core_usage_average": metric.cpu_core_usage_average,
                    "cpu_core_request_average": metric.cpu_core_request_average,
                    "ram_byte_usage_average": metric.ram_byte_usage_average,
                    "ram_byte_request_average": metric.ram_byte_request_average,
                    "total_efficiency": metric.total_efficiency,
                    "cpu_usage_percent": metric.cpu_usage_percent,
                    "memory_usage_percent": metric.memory_usage_percent,
                    "node_status": metric.node_status,
                    "node_instance_type": metric.node_instance_type,
                    "node_zone": metric.node_zone,
                    "is_active": metric.is_active,
                    "created_at": (
                        metric.created_at.isoformat() if metric.created_at else None
                    ),
                }
            )

        return (
            jsonify(
                {
                    "data": result,
                    "total_count": total_count,
                    "limit": limit,
                    "offset": offset,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@clusters_bp.route("/pods", methods=["GET"])
def get_pod_metrics():
    """
    Get pod metrics with optional filtering
    Query params: namespace, name, window, limit, offset, start_date, end_date
    """
    session = db_manager.get_session()
    try:
        query = session.query(PodMetrics)

        # Apply filters
        namespace = request.args.get("namespace")
        if namespace:
            query = query.filter(PodMetrics.namespace == namespace)

        name = request.args.get("name")
        if name:
            query = query.filter(PodMetrics.name == name)

        window = request.args.get("window")
        if window:
            query = query.filter(PodMetrics.window == window)

        start_date = request.args.get("start_date")
        if start_date:
            start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(PodMetrics.start_time >= start_date)

        end_date = request.args.get("end_date")
        if end_date:
            end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(PodMetrics.end_time <= end_date)

        # Pagination
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))

        # Order by start_time desc
        query = query.order_by(desc(PodMetrics.start_time))

        total_count = query.count()
        metrics = query.limit(limit).offset(offset).all()

        result = []
        for metric in metrics:
            result.append(
                {
                    "id": metric.id,
                    "key": metric.key,
                    "namespace": metric.namespace,
                    "name": metric.name,
                    "start_time": (
                        metric.start_time.isoformat() if metric.start_time else None
                    ),
                    "end_time": (
                        metric.end_time.isoformat() if metric.end_time else None
                    ),
                    "window": metric.window,
                    "total_cost": metric.total_cost,
                    "cpu_cost": metric.cpu_cost,
                    "ram_cost": metric.ram_cost,
                    "cpu_core_usage_average": metric.cpu_core_usage_average,
                    "cpu_core_request_average": metric.cpu_core_request_average,
                    "ram_byte_usage_average": metric.ram_byte_usage_average,
                    "ram_byte_request_average": metric.ram_byte_request_average,
                    "total_efficiency": metric.total_efficiency,
                    "cpu_efficiency": metric.cpu_efficiency,
                    "ram_efficiency": metric.ram_efficiency,
                    "is_idle": metric.is_idle,
                    "domain": metric.domain,
                    "created_at": (
                        metric.created_at.isoformat() if metric.created_at else None
                    ),
                }
            )

        return (
            jsonify(
                {
                    "data": result,
                    "total_count": total_count,
                    "limit": limit,
                    "offset": offset,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@clusters_bp.route("/get_pod_details", methods=["GET"])
def getPodDetail():
    """
    Get specific pod details by ID or key
    Query params: id, key
    """
    session = db_manager.get_session()
    try:
        pod_id = request.args.get("id")
        pod_key = request.args.get("key")

        if not pod_id and not pod_key:
            return jsonify({"error": "Either 'id' or 'key' parameter is required"}), 400

        query = session.query(PodMetrics)

        if pod_id:
            query = query.filter(PodMetrics.id == pod_id)
        elif pod_key:
            query = query.filter(PodMetrics.key == pod_key)

        pod = query.first()

        if not pod:
            return jsonify({"error": "Pod not found"}), 404

        result = {
            "id": pod.id,
            "key": pod.key,
            "namespace": pod.namespace,
            "name": pod.name,
            "start_time": pod.start_time.isoformat() if pod.start_time else None,
            "end_time": pod.end_time.isoformat() if pod.end_time else None,
            "window": pod.window,
            "total_cost": pod.total_cost,
            "cpu_cost": pod.cpu_cost,
            "ram_cost": pod.ram_cost,
            "gpu_cost": pod.gpu_cost,
            "pv_cost": pod.pv_cost,
            "network_cost": pod.network_cost,
            "load_balancer_cost": pod.load_balancer_cost,
            "external_cost": pod.external_cost,
            "shared_cost": pod.shared_cost,
            "cpu_core_usage_average": pod.cpu_core_usage_average,
            "cpu_core_request_average": pod.cpu_core_request_average,
            "ram_byte_usage_average": pod.ram_byte_usage_average,
            "ram_byte_request_average": pod.ram_byte_request_average,
            "gpu_usage_average": pod.gpu_usage_average,
            "gpu_request_average": pod.gpu_request_average,
            "ram_usage_gb": pod.ram_usage_gb,
            "ram_request_gb": pod.ram_request_gb,
            "total_efficiency": pod.total_efficiency,
            "cpu_efficiency": pod.cpu_efficiency,
            "ram_efficiency": pod.ram_efficiency,
            "is_idle": pod.is_idle,
            "domain": pod.domain,
            "created_at": pod.created_at.isoformat() if pod.created_at else None,
            "updated_at": pod.updated_at.isoformat() if pod.updated_at else None,
            "raw_allocation_data": pod.raw_allocation_data,
        }

        return jsonify({"data": result}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@clusters_bp.route("/dashboard/summary", methods=["GET"])
def get_dashboard_summary():
    """
    Get dashboard summary with aggregated metrics
    """
    session = db_manager.get_session()
    try:
        # Get latest cluster metrics
        latest_cluster_metrics = (
            session.query(ClusterMetrics)
            .order_by(desc(ClusterMetrics.timestamp))
            .limit(10)
            .all()
        )

        # Get aggregated data
        total_clusters = session.query(ClusterMetrics.cluster_name).distinct().count()
        total_nodes = session.query(NodeMetrics.node_name).distinct().count()
        total_pods = session.query(PodMetrics).count()

        # Calculate total costs (from latest data)
        total_cost = 0
        if latest_cluster_metrics:
            total_cost = sum(
                metric.total_cost or 0 for metric in latest_cluster_metrics
            )

        # Get efficiency stats
        avg_efficiency = (
            session.query(ClusterMetrics.total_efficiency)
            .filter(ClusterMetrics.total_efficiency.isnot(None))
            .all()
        )

        avg_efficiency_value = 0
        if avg_efficiency:
            avg_efficiency_value = sum(eff[0] or 0 for eff in avg_efficiency) / len(
                avg_efficiency
            )

        summary = {
            "total_clusters": total_clusters,
            "total_nodes": total_nodes,
            "total_pods": total_pods,
            "total_cost": round(total_cost, 2),
            "average_efficiency": round(avg_efficiency_value, 2),
            "latest_metrics": [
                {
                    "cluster_name": metric.cluster_name,
                    "total_cost": metric.total_cost,
                    "efficiency": metric.total_efficiency,
                    "timestamp": (
                        metric.timestamp.isoformat() if metric.timestamp else None
                    ),
                }
                for metric in latest_cluster_metrics
            ],
        }

        return jsonify({"data": summary}), 200

    except Exception as e:
        print(e, "-")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# ================================
# Bulk Metrics Ingestion Endpoint
# ================================
@clusters_bp.route("/fetchMetrics", methods=["POST"])
def fetch_metrics():
    """
    Bulk insert metrics for clusters, nodes, and pods from nested JSON structure.
    Expects JSON with user_id, cluster_id, and snapshots array.
    Creates proper relationships between cluster -> nodes -> pods.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    results = {"cluster_metrics": 0, "node_metrics": 0, "pod_metrics": 0, "errors": []}
    session = db_manager.get_session()
    unique_id = generate_uuid()
    try:
        # Extract snapshots from the JSON
        snapshots = data.get("snapshots", [])
        user_id = data.get("user_id")
        cluster_id = data.get("cluster_id")

        for snapshot in snapshots:
            allocations = snapshot.get("allocations", {})
            window_info = snapshot.get("window", {})

            for allocation_key, allocation_data in allocations.items():
                cluster_obj = None

                try:
                    # Process all allocations including idle for cluster metrics
                    # Create ClusterMetrics entry
                    cluster_entry = {
                        "unique_id": unique_id,
                        "cluster_name": allocation_data.get("cluster_name"),
                        "timestamp": allocation_data.get("timestamp"),
                        "window_start": allocation_data.get("window_start"),
                        "window_end": allocation_data.get("window_end"),
                        "window_duration": allocation_data.get("window_duration"),
                        "total_cost": allocation_data.get("total_cost", 0.0),
                        "cpu_cost": allocation_data.get("cpu_cost", 0.0),
                        "cpu_cost_idle": allocation_data.get("cpu_cost_idle", 0.0),
                        "ram_cost": allocation_data.get("ram_cost", 0.0),
                        "ram_cost_idle": allocation_data.get("ram_cost_idle", 0.0),
                        "pv_cost": allocation_data.get("pv_cost", 0.0),
                        "network_cost": allocation_data.get("network_cost", 0.0),
                        "gpu_cost": allocation_data.get("gpu_cost", 0.0),
                        "gpu_cost_idle": allocation_data.get("gpu_cost_idle", 0.0),
                        "load_balancer_cost": allocation_data.get(
                            "load_balancer_cost", 0.0
                        ),
                        "external_cost": allocation_data.get("external_cost", 0.0),
                        "shared_cost": allocation_data.get("shared_cost", 0.0),
                        "cpu_core_request_average": allocation_data.get(
                            "cpu_core_request_average", 0.0
                        ),
                        "cpu_core_usage_average": allocation_data.get(
                            "cpu_core_usage_average", 0.0
                        ),
                        "ram_byte_request_average": allocation_data.get(
                            "ram_byte_request_average", 0.0
                        ),
                        "ram_byte_usage_average": allocation_data.get(
                            "ram_byte_usage_average", 0.0
                        ),
                        "gpu_request_average": allocation_data.get(
                            "gpu_request_average", 0.0
                        ),
                        "gpu_usage_average": allocation_data.get(
                            "gpu_usage_average", 0.0
                        ),
                        "total_efficiency": allocation_data.get(
                            "total_efficiency", 0.0
                        ),
                        "cpu_usage_percent": allocation_data.get(
                            "cpu_usage_percent", 0.0
                        ),
                        "memory_usage_percent": allocation_data.get(
                            "memory_usage_percent", 0.0
                        ),
                        "memory_gb_used": allocation_data.get("memory_gb_used", 0.0),
                        "memory_gb_requested": allocation_data.get(
                            "memory_gb_requested", 0.0
                        ),
                        "efficiency_percent": allocation_data.get(
                            "efficiency_percent", 0.0
                        ),
                        "cluster_status": allocation_data.get("cluster_status"),
                        "cluster_version": allocation_data.get("cluster_version"),
                        "node_count": allocation_data.get("node_count"),
                        "pod_count": allocation_data.get("pod_count"),
                        "efficiency_category": allocation_data.get(
                            "efficiency_category"
                        ),
                        "is_idle_allocation": allocation_data.get(
                            "is_idle_allocation", False
                        ),
                        "query_params": allocation_data.get("query_params"),
                        "fetch_timestamp": allocation_data.get("fetch_timestamp"),
                        "cluster_id": cluster_id,
                        "user_id": user_id,
                        "raw_api_response": allocation_data,
                    }

                    cluster_obj = ClusterMetrics(**cluster_entry)
                    session.add(cluster_obj)
                    session.flush()  # This assigns the ID to cluster_obj
                    results["cluster_metrics"] += 1

                    # Process node data if available (only for non-idle cluster allocations)
                    if allocation_key != "__idle__":
                        node_data = allocation_data.get("node_data", {})
                        if node_data and node_data.get("data"):
                            node_sets = node_data["data"].get("sets", [])

                            for node_set in node_sets:
                                node_allocations = node_set.get("allocations", {})

                                for (
                                    node_key,
                                    node_allocation,
                                ) in node_allocations.items():
                                    node_obj = None

                                    try:
                                        # Create NodeMetrics entry with cluster_id foreign key
                                        node_entry = {
                                            "cluster_id": cluster_obj.id,  # Foreign key to cluster
                                            "node_name": node_allocation.get(
                                                "node_name"
                                            ),
                                            "cluster_name": node_allocation.get(
                                                "cluster_name"
                                            ),
                                            "timestamp": node_allocation.get(
                                                "timestamp"
                                            ),
                                            "window_start": node_allocation.get(
                                                "window_start"
                                            ),
                                            "window_end": node_allocation.get(
                                                "window_end"
                                            ),
                                            "window_duration": node_allocation.get(
                                                "window_duration"
                                            ),
                                            "total_cost": node_allocation.get(
                                                "total_cost", 0.0
                                            ),
                                            "cpu_cost": node_allocation.get(
                                                "cpu_cost", 0.0
                                            ),
                                            "cpu_cost_idle": node_allocation.get(
                                                "cpu_cost_idle", 0.0
                                            ),
                                            "ram_cost": node_allocation.get(
                                                "ram_cost", 0.0
                                            ),
                                            "ram_cost_idle": node_allocation.get(
                                                "ram_cost_idle", 0.0
                                            ),
                                            "pv_cost": node_allocation.get(
                                                "pv_cost", 0.0
                                            ),
                                            "network_cost": node_allocation.get(
                                                "network_cost", 0.0
                                            ),
                                            "gpu_cost": node_allocation.get(
                                                "gpu_cost", 0.0
                                            ),
                                            "gpu_cost_idle": node_allocation.get(
                                                "gpu_cost_idle", 0.0
                                            ),
                                            "load_balancer_cost": node_allocation.get(
                                                "load_balancer_cost", 0.0
                                            ),
                                            "external_cost": node_allocation.get(
                                                "external_cost", 0.0
                                            ),
                                            "shared_cost": node_allocation.get(
                                                "shared_cost", 0.0
                                            ),
                                            "cpu_core_request_average": node_allocation.get(
                                                "cpu_core_request_average", 0.0
                                            ),
                                            "cpu_core_usage_average": node_allocation.get(
                                                "cpu_core_usage_average", 0.0
                                            ),
                                            "ram_byte_request_average": node_allocation.get(
                                                "ram_byte_request_average", 0.0
                                            ),
                                            "ram_byte_usage_average": node_allocation.get(
                                                "ram_byte_usage_average", 0.0
                                            ),
                                            "gpu_request_average": node_allocation.get(
                                                "gpu_request_average", 0.0
                                            ),
                                            "gpu_usage_average": node_allocation.get(
                                                "gpu_usage_average", 0.0
                                            ),
                                            "total_efficiency": node_allocation.get(
                                                "total_efficiency", 0.0
                                            ),
                                            "cpu_usage_percent": node_allocation.get(
                                                "cpu_usage_percent", 0.0
                                            ),
                                            "memory_usage_percent": node_allocation.get(
                                                "memory_usage_percent", 0.0
                                            ),
                                            "memory_gb_used": node_allocation.get(
                                                "memory_gb_used", 0.0
                                            ),
                                            "memory_gb_requested": node_allocation.get(
                                                "memory_gb_requested", 0.0
                                            ),
                                            "efficiency_percent": node_allocation.get(
                                                "efficiency_percent", 0.0
                                            ),
                                            "node_status": node_allocation.get(
                                                "node_status"
                                            ),
                                            "node_health_score": node_allocation.get(
                                                "node_health_score"
                                            ),
                                            "node_instance_type": node_allocation.get(
                                                "node_instance_type"
                                            ),
                                            "node_zone": node_allocation.get(
                                                "node_zone"
                                            ),
                                            "is_idle_allocation": node_allocation.get(
                                                "is_idle_allocation", False
                                            ),
                                            "is_unallocated": node_allocation.get(
                                                "is_unallocated", False
                                            ),
                                            "is_system_allocation": node_allocation.get(
                                                "is_system_allocation", False
                                            ),
                                            "first_seen": node_allocation.get(
                                                "first_seen"
                                            ),
                                            "last_seen": node_allocation.get(
                                                "last_seen"
                                            ),
                                            "is_active": node_allocation.get(
                                                "is_active", True
                                            ),
                                            "cluster_id": cluster_id,
                                            "user_id": user_id,
                                        }

                                        node_obj = NodeMetrics(**node_entry)
                                        session.add(node_obj)
                                        session.flush()  # This assigns the ID to node_obj
                                        results["node_metrics"] += 1

                                        # Process pod data if available
                                        pod_data = node_allocation.get("pod_data", {})
                                        if pod_data and pod_data.get("data"):
                                            pod_sets = pod_data["data"].get("sets", [])

                                            for pod_set in pod_sets:
                                                pod_allocations = pod_set.get(
                                                    "allocations", {}
                                                )

                                                for (
                                                    pod_key,
                                                    pod_allocation,
                                                ) in pod_allocations.items():
                                                    try:
                                                        # Create PodMetrics entry with node_id foreign key
                                                        pod_entry = {
                                                            "node_id": node_obj.id,  # Foreign key to node
                                                            "key": pod_allocation.get(
                                                                "key"
                                                            ),
                                                            "namespace": pod_allocation.get(
                                                                "namespace"
                                                            ),
                                                            "name": pod_allocation.get(
                                                                "name"
                                                            ),
                                                            "start_time": pod_allocation.get(
                                                                "start_time"
                                                            ),
                                                            "end_time": pod_allocation.get(
                                                                "end_time"
                                                            ),
                                                            "window": pod_allocation.get(
                                                                "window"
                                                            ),
                                                            "cpu_core_usage_average": pod_allocation.get(
                                                                "cpu_core_usage_average",
                                                                0.0,
                                                            ),
                                                            "cpu_core_request_average": pod_allocation.get(
                                                                "cpu_core_request_average",
                                                                0.0,
                                                            ),
                                                            "cpu_cost": pod_allocation.get(
                                                                "cpu_cost", 0.0
                                                            ),
                                                            "ram_byte_usage_average": pod_allocation.get(
                                                                "ram_byte_usage_average",
                                                                0.0,
                                                            ),
                                                            "ram_byte_request_average": pod_allocation.get(
                                                                "ram_byte_request_average",
                                                                0.0,
                                                            ),
                                                            "ram_cost": pod_allocation.get(
                                                                "ram_cost", 0.0
                                                            ),
                                                            "gpu_cost": pod_allocation.get(
                                                                "gpu_cost", 0.0
                                                            ),
                                                            "gpu_cost_idle": pod_allocation.get(
                                                                "gpu_cost_idle", 0.0
                                                            ),
                                                            "gpu_request_average": pod_allocation.get(
                                                                "gpu_request_average",
                                                                0.0,
                                                            ),
                                                            "gpu_usage_average": pod_allocation.get(
                                                                "gpu_usage_average", 0.0
                                                            ),
                                                            "pv_cost": pod_allocation.get(
                                                                "pv_cost", 0.0
                                                            ),
                                                            "pv_bytes": pod_allocation.get(
                                                                "pv_bytes"
                                                            ),
                                                            "cpu_cost_idle": pod_allocation.get(
                                                                "cpu_cost_idle", 0.0
                                                            ),
                                                            "ram_cost_idle": pod_allocation.get(
                                                                "ram_cost_idle", 0.0
                                                            ),
                                                            "external_cost": pod_allocation.get(
                                                                "external_cost", 0.0
                                                            ),
                                                            "load_balancer_cost": pod_allocation.get(
                                                                "load_balancer_cost",
                                                                0.0,
                                                            ),
                                                            "network_cost": pod_allocation.get(
                                                                "network_cost", 0.0
                                                            ),
                                                            "total_cost": pod_allocation.get(
                                                                "total_cost", 0.0
                                                            ),
                                                            "shared_cost": pod_allocation.get(
                                                                "shared_cost", 0.0
                                                            ),
                                                            "ram_usage_gb": pod_allocation.get(
                                                                "ram_usage_gb", 0.0
                                                            ),
                                                            "ram_request_gb": pod_allocation.get(
                                                                "ram_request_gb", 0.0
                                                            ),
                                                            "cpu_efficiency": pod_allocation.get(
                                                                "cpu_efficiency", 0.0
                                                            ),
                                                            "ram_efficiency": pod_allocation.get(
                                                                "ram_efficiency", 0.0
                                                            ),
                                                            "total_efficiency": pod_allocation.get(
                                                                "total_efficiency", 0.0
                                                            ),
                                                            "is_idle": pod_allocation.get(
                                                                "is_idle", False
                                                            ),
                                                            "domain": pod_allocation.get(
                                                                "domain"
                                                            ),
                                                            "cluster_id": cluster_id,
                                                            "user_id": user_id,
                                                            "raw_allocation_data": pod_allocation,  # Store the full pod data
                                                        }

                                                        pod_obj = PodMetrics(
                                                            **pod_entry
                                                        )
                                                        session.add(pod_obj)
                                                        results["pod_metrics"] += 1

                                                    except Exception as e:
                                                        results["errors"].append(
                                                            f"PodMetrics {pod_key}: {str(e)}"
                                                        )

                                    except Exception as e:
                                        results["errors"].append(
                                            f"NodeMetrics {node_key}: {str(e)}"
                                        )

                except Exception as e:
                    results["errors"].append(
                        f"ClusterMetrics {allocation_key}: {str(e)}"
                    )

        session.commit()
        return jsonify({"message": "Metrics ingested successfully", **results}), 201

    except Exception as e:
        session.rollback()
        return (
            jsonify({"error": f"Failed to process metrics: {str(e)}"}, **results),
            500,
        )
    finally:
        session.close()


@clusters_bp.route("/instance", methods=["GET"])
def get_instance():
    session = db_manager.get_session()
    try:

        data = [
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-testt",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "e2medium",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "0",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "e2medium",
                            "gpu_np_max_node_count": "2",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-12T11:55:18.884023",
                "id": 49,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-12T11:55:18.884028",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-test",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "e2medium",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "0",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "e2medium",
                            "gpu_np_max_node_count": "2",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-12T11:40:47.650503",
                "id": 48,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-12T11:40:47.650507",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-prod",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "e2medium",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "0",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "e2medium",
                            "gpu_np_max_node_count": "2",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "cpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-11T16:51:29.327589",
                "id": 47,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-12T06:37:31.086685",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-uat",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "e2-medium",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "0",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "e2-medium",
                            "gpu_np_max_node_count": "1",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-11T12:25:27.150346",
                "id": 46,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-11T12:25:27.150352",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "africa-south1-a",
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-uatt",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "e2-medium",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "0",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-pocc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "e2-medium",
                            "gpu_np_max_node_count": "3",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-11T12:05:38.033586",
                "id": 45,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-11T12:05:38.033591",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls2-sify-devvv",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "on-demand",
                            "cpu_np_instance_type": "standard",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "1",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "standard",
                            "gpu_np_max_node_count": "2",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-06T07:21:40.147056",
                "id": 44,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-11T12:36:00.525900",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls1-sifypocc",
                    "cpuPools": [
                        {
                            "cpu_np_capacity_type": "spot",
                            "cpu_np_instance_type": "standard",
                            "cpu_np_max_node_count": "2",
                            "cpu_np_min_node_count": "1",
                            "cpu_np_name": "cpu2x",
                        }
                    ],
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "gpuPools": [
                        {
                            "gpu_np_capacity_type": "on-demand",
                            "gpu_np_instance_type": "standard",
                            "gpu_np_max_node_count": "2",
                            "gpu_np_min_node_count": "0",
                            "gpu_np_name": "gpu2x",
                        }
                    ],
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-04T12:04:36.616462",
                "id": 43,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-04T12:04:36.616466",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["africa-south1-a", "africa-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls1-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "africa-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "networkTags": ["dev"],
                    "platformFeatures": [
                        "blobStorage",
                        "clusterIntegration",
                        "registry",
                    ],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-04T04:57:37.633223",
                "id": 42,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-04T04:57:37.633230",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gke-clusterr-sifypocc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.30",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-08-03T17:24:46.623175",
                "id": 41,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-08-03T17:24:46.623180",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "july291",
                    },
                    "clusterName": "gcp-cls1-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "networkTags": [],
                    "platformFeatures": [],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T16:04:23.411619",
                "id": 39,
                "status": 1,
                "terraform_file": "terraform_20250728160423416676.tfvars",
                "updated_at": "2025-08-03T17:01:52.462246",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bucket bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "networkTags": ["dev"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T15:54:19.162771",
                "id": 38,
                "status": 1,
                "terraform_file": "terraform_1753718059.tfvars",
                "updated_at": "2025-08-03T17:04:33.288140",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bucket bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T15:50:41.020899",
                "id": 37,
                "status": 1,
                "terraform_file": "terraform_1753717841.tfvars",
                "updated_at": "2025-07-28T15:54:09.637265",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bucket bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T15:47:58.732284",
                "id": 36,
                "status": 1,
                "terraform_file": "terraform_1753717678.tfvars",
                "updated_at": "2025-08-03T17:07:16.765306",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T15:31:10.172588",
                "id": 35,
                "status": 1,
                "terraform_file": "terraform_1753716670.tfvars",
                "updated_at": "2025-07-28T15:31:10.172593",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "asia-south1-a",
                        "asia-south1-b",
                        "asia-south1-c",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.2.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "networkTags": [""],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T15:29:03.764934",
                "id": 34,
                "status": 1,
                "terraform_file": "terraform_1753716543.tfvars",
                "updated_at": "2025-07-28T15:29:03.764939",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "us-central1-a",
                        "asia-south1-a",
                        "asia-south1-b",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.1.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T13:17:21.505548",
                "id": 33,
                "status": 1,
                "terraform_file": "terraform_1753708641.tfvars",
                "updated_at": "2025-07-28T13:17:21.505553",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": [
                        "us-central1-a",
                        "asia-south1-a",
                        "asia-south1-b",
                    ],
                    "bucketConfig": {
                        "gcsBucketName": "bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.1.0.0/21",
                    "kubernetesVersion": "1.31",
                    "networkConfig": "create-new",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T13:12:34.142650",
                "id": 32,
                "status": 1,
                "terraform_file": "terraform_1753708354.tfvars",
                "updated_at": "2025-07-28T13:12:34.142655",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "availabilityZones": ["asia-south1-a", "asia-south1-b"],
                    "bucketConfig": {
                        "gcsBucketName": "bucket bkt-ai-platform-gke-test",
                        "prefixPath": "test",
                    },
                    "clusterName": "gke-cluster-sifypoc",
                    "gcpProjectId": "sify-ai-poc",
                    "gcpRegion": "asia-south1",
                    "ipv4CidrBlock": "10.3.0.0/28",
                    "ipv4CidrPods": "10.1.0.0/21",
                    "ipv4CidrPrivateSubnet": "10.128.0.0/20",
                    "ipv4CidrServices": "10.1.0.0/21",
                    "kubernetesVersion": "1.30",
                    "networkConfig": "create-new",
                    "networkTags": ["dev"],
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "podRangeName": "kubernetes-pod-range",
                    "serviceRangeName": "kubernetes-services-range",
                    "user_id": 1,
                },
                "created_at": "2025-07-28T13:02:35.751081",
                "id": 31,
                "status": 1,
                "terraform_file": "terraform_1753707755.tfvars",
                "updated_at": "2025-07-28T13:02:35.751086",
                "user_id": 1,
            },
            {
                "cluster_type": "aws",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1b", "us-east-1c"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/"],
                        "loadBalancerType": "public",
                    },
                    "clusterName": "New AWS Cluster",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage"],
                    "privateSubnetCidrs": ["Subnet CIDRs"],
                    "publicSubnetCidrs": ["Subnet CIDRs"],
                    "region": "us-east-1",
                    "s3BucketName": "image bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-09T06:53:17.653958",
                "id": 7,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-09T06:53:17.653958",
                "user_id": 1,
            },
            {
                "cluster_type": "aws",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1b", "us-east-1c"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/"],
                        "loadBalancerType": "public",
                    },
                    "clusterName": "New AWS Cluster",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage"],
                    "privateSubnetCidrs": ["Subnet CIDRs"],
                    "publicSubnetCidrs": ["Subnet CIDRs"],
                    "region": "us-east-1",
                    "s3BucketName": "image bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-09T06:52:48.518356",
                "id": 6,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-09T06:52:48.518356",
                "user_id": 1,
            },
            {
                "cluster_type": "aws",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1b", "us-east-1c"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/"],
                        "loadBalancerType": "public",
                    },
                    "clusterName": "New AWS Cluster",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage"],
                    "privateSubnetCidrs": ["Subnet CIDRs"],
                    "publicSubnetCidrs": ["Subnet CIDRs"],
                    "region": "us-east-1",
                    "s3BucketName": "image bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-09T06:52:27.352016",
                "id": 5,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-09T06:52:27.352016",
                "user_id": 1,
            },
            {
                "cluster_type": "sify",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1a", "us-east-1b"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {"loadBalancerType": "public"},
                    "clusterName": "test cluster",
                    "dynamodbTableName": "test db",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": [
                        "blobStorage",
                        "clusterIntegration",
                        "registry",
                    ],
                    "privateSubnetCidrs": ["qetrqegf"],
                    "publicSubnetCidrs": ["west"],
                    "region": "us-east-1",
                    "s3BucketName": "testdata bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-07T10:37:40.990886",
                "id": 4,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-07T10:37:40.990886",
                "user_id": 1,
            },
            {
                "cluster_type": "gcp",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1c"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/platform_ai"],
                        "loadBalancerType": "public",
                        "sslCertificates": ["no ssl"],
                    },
                    "clusterName": "test cluster 03",
                    "dynamodbTableName": "test db",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage", "clusterIntegration"],
                    "privateSubnetCidrs": ["Public Subnet CIDRs"],
                    "publicSubnetCidrs": ["Public Subnet CIDRs"],
                    "region": "eu-west-3",
                    "s3BucketName": "testdata bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-07T09:58:37.938251",
                "id": 3,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-07T09:58:37.938251",
                "user_id": 1,
            },
            {
                "cluster_type": "azure",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1a", "us-east-1b"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/"],
                        "loadBalancerType": "public",
                        "sslCertificates": [],
                    },
                    "clusterName": "test cluster 02",
                    "dynamodbTableName": "test db",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage", "registry"],
                    "privateSubnetCidrs": [],
                    "publicSubnetCidrs": ["efgwrwrh"],
                    "region": "us-east-1",
                    "s3BucketName": "testdata bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-07T09:48:46.873193",
                "id": 2,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-07T09:48:46.873193",
                "user_id": 1,
            },
            {
                "cluster_type": "aws",
                "config": {
                    "authentication": "aws-profile",
                    "availabilityZones": ["us-east-1a", "us-east-1b"],
                    "awsProfile": "new_profile",
                    "certificateConfig": {
                        "domainNames": ["http://localhost:3000/"],
                        "loadBalancerType": "public",
                        "sslCertificates": [],
                    },
                    "clusterName": "test cluster 1",
                    "dynamodbTableName": "test db",
                    "kubernetesVersion": "1.32",
                    "platformFeatures": ["blobStorage", "registry"],
                    "privateSubnetCidrs": [],
                    "publicSubnetCidrs": ["efgwrwrh"],
                    "region": "us-east-1",
                    "s3BucketName": "testdata bucket",
                    "vpcCidr": "test VPC CIDR",
                },
                "created_at": "2025-07-07T01:47:05.654526",
                "id": 1,
                "status": 1,
                "terraform_file": None,
                "updated_at": "2025-07-07T01:47:05.654526",
                "user_id": 1,
            },
        ]
        return jsonify({"message": "Metrics ingested", "data": data}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
