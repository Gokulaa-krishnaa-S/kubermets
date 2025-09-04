from flask import Blueprint, jsonify, Response, request
import requests
from models.model import ClusterMetrics, NodeMetrics, PodMetrics
from models.model import db_manager
from sqlalchemy import desc, asc, func
from routes.node import get_node_data

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


@clusters_bp.route("/clusters", methods=["GET"])
def get_cluster_metrics():
    """
    Fetch cluster metrics by cluster_id with optional time window duration
    Params:
      cluster_id (required)
      duration: 24h, 3d, 7d, 1m, 6m (default: 24h)
    """
    print("=== Fetching cluster metrics ===")
    session = db_manager.get_session()
    try:
        API_URL = os.getenv("BACKEND_API_URL")
        # 1️ Get cluster_id from request
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id", "1")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        # 2️ Get duration (default: 24h)
        duration = request.args.get("window", "24h")
        print(duration, "--------------DURATION")

        # Convert duration into datetime filter
        end_time = datetime.utcnow()
        if duration.endswith("h"):
            hours = int(duration[:-1])
            start_time = end_time - timedelta(hours=hours)
        elif duration.endswith("d"):
            days = int(duration[:-1])
            start_time = end_time - timedelta(days=days)
        elif duration.endswith("m"): 
            months = int(duration[:-1])
            start_time = end_time - timedelta(days=months * 30)
        else:
            return jsonify({"error": "Invalid duration format"}), 400

        print(start_time, "---START TIME------", end_time)

        # 3️ Fetch rows within time window
        rows = (
            session.query(ClusterMetrics)
            .filter(
                ClusterMetrics.user_id == user_id,
                ClusterMetrics.cluster_id == cluster_id,
                ClusterMetrics.window_end > start_time,    
                ClusterMetrics.window_start < end_time,  
            )
            .all()
        )

        if not rows:
            return (
                jsonify(
                    {
                        "cluster_id": cluster_id,
                        "duration": duration,
                        "data": [],
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                    }
                ),
                200,
            )

        print(f"Found {len(rows)} rows")

        # 4️ Aggregate by (cluster_id, cluster_name) - separate idle and active
        aggregated = {}

        for row in rows:

            # key = (row.cluster_id, row.cluster_name)  # Group by both cluster_id and cluster_name
            key = (
                row.cluster_id,
                row.cluster_name,
            )  # Group by both cluster_id and cluster_name
            if key not in aggregated:
                aggregated[key] = {
                    "cluster_id": row.cluster_id,
                    "cluster_name": row.cluster_name,
                    "total_cost": 0.0,
                    "cpu_cost": 0.0,
                    "cpu_cost_idle": 0.0,
                    "ram_cost": 0.0,
                    "ram_cost_idle": 0.0,
                    "pv_cost": 0.0,
                    "network_cost": 0.0,
                    "gpu_cost": 0.0,
                    "gpu_cost_idle": 0.0,
                    "load_balancer_cost": 0.0,
                    "external_cost": 0.0,
                    "shared_cost": 0.0,
                    # Collect values to average later
                    "_cpu_core_request_vals": [],
                    "_cpu_core_usage_vals": [],
                    "_ram_byte_request_vals": [],
                    "_ram_byte_usage_vals": [],
                    "_gpu_request_vals": [],
                    "_gpu_usage_vals": [],
                    "_efficiency_vals": [],
                    "_cpu_percent_vals": [],
                    "_mem_percent_vals": [],
                    "_efficiency_percent_vals": [],
                    "_memory_gb_used_vals": [],
                    "_memory_gb_req_vals": [],
                    "cluster_status": row.cluster_status,
                    "node_count": 0,
                    "pod_count": 0,
                    "efficiency_category": row.efficiency_category,
                    "is_idle_allocation": row.is_idle_allocation,
                    "timestamps": [],
                }

            agg = aggregated[key]

            # Sum cost metrics
            agg["total_cost"] += row.total_cost
            agg["cpu_cost"] += row.cpu_cost
            agg["cpu_cost_idle"] += row.cpu_cost_idle
            agg["ram_cost"] += row.ram_cost
            agg["ram_cost_idle"] += row.ram_cost_idle
            agg["pv_cost"] += row.pv_cost
            agg["network_cost"] += row.network_cost
            agg["gpu_cost"] += row.gpu_cost
            agg["gpu_cost_idle"] += row.gpu_cost_idle
            agg["load_balancer_cost"] += row.load_balancer_cost
            agg["external_cost"] += row.external_cost
            agg["shared_cost"] += row.shared_cost
            agg["node_count"] += row.node_count
            agg["pod_count"] += row.pod_count

            # Collect values for averaging
            agg["_cpu_core_request_vals"].append(row.cpu_core_request_average)
            agg["_cpu_core_usage_vals"].append(row.cpu_core_usage_average)
            agg["_ram_byte_request_vals"].append(row.ram_byte_request_average)
            agg["_ram_byte_usage_vals"].append(row.ram_byte_usage_average)
            agg["_gpu_request_vals"].append(row.gpu_request_average)
            agg["_gpu_usage_vals"].append(row.gpu_usage_average)
            agg["_efficiency_vals"].append(row.total_efficiency)
            agg["_cpu_percent_vals"].append(row.cpu_usage_percent)
            agg["_mem_percent_vals"].append(row.memory_usage_percent)
            agg["_memory_gb_used_vals"].append(row.memory_gb_used)
            agg["_memory_gb_req_vals"].append(row.memory_gb_requested)
            agg["_efficiency_percent_vals"].append(row.efficiency_percent)

            agg["timestamps"].append(row.timestamp.isoformat())

        # 5️ Finalize averages
        for agg in aggregated.values():

            def avg(values):
                return sum(values) / len(values) if values else 0.0

            agg["cpu_core_request_average"] = avg(agg.pop("_cpu_core_request_vals"))
            agg["cpu_core_usage_average"] = avg(agg.pop("_cpu_core_usage_vals"))
            agg["ram_byte_request_average"] = avg(agg.pop("_ram_byte_request_vals"))
            agg["ram_byte_usage_average"] = avg(agg.pop("_ram_byte_usage_vals"))
            agg["gpu_request_average"] = avg(agg.pop("_gpu_request_vals"))
            agg["gpu_usage_average"] = avg(agg.pop("_gpu_usage_vals"))
            agg["total_efficiency"] = avg(agg.pop("_efficiency_vals"))
            agg["cpu_usage_percent"] = avg(agg.pop("_cpu_percent_vals"))
            agg["memory_usage_percent"] = avg(agg.pop("_mem_percent_vals"))
            agg["memory_gb_used"] = avg(agg.pop("_memory_gb_used_vals"))
            agg["memory_gb_requested"] = avg(agg.pop("_memory_gb_req_vals"))
            agg["efficiency_percent"] = avg(agg.pop("_efficiency_percent_vals"))

        return (
            jsonify(
                {
                    "cluster_id": cluster_id,
                    "duration": duration,
                    "data": list(aggregated.values()),
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error in get_cluster_metrics: {str(e)}")
        return (
            jsonify({"error": "Failed to fetch cluster metrics", "message": str(e)}),
            500,
        )
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


@clusters_bp.route("/latest-timestamp", methods=["GET"])
def get_latest_timestamp_route():
    """

    Fetch the most recent record's timestamp for a given cluster_id.

    """
    cluster_id = request.args.get("cluster_id", type=int)
    if not cluster_id:
        return jsonify({"error": "cluster_id is required"}), 400
    session = db_manager.get_session()
    try:

        latest_record = (
        session.query(ClusterMetrics.window_end, ClusterMetrics.window_duration)
        .filter(ClusterMetrics.cluster_id == cluster_id)
        .order_by(desc(ClusterMetrics.window_end))
        .first()
        )

        print(latest_record , "--------")
        if not latest_record:
            return (
                jsonify({"message": f"No records found for cluster_id={cluster_id}"}),
                404,
            )

        return jsonify({"latest_timestamp": latest_record.window_end.isoformat() , "window_duration":latest_record.window_duration}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@clusters_bp.route("/dashboard/summary", methods=["GET"])
def dashboard_summary():
    """
    Dashboard summary: aggregated metrics for all clusters from DB
    """
    window = request.args.get("window", "7d")
    user_id = request.args.get("user_id", "1")  # Optional multi-user support

    session = db_manager.get_session()
    try:
        # 1️ Parse window duration
        end_time = datetime.utcnow()
        if window.endswith("h"):
            start_time = end_time - timedelta(hours=int(window[:-1]))
        elif window.endswith("d"):
            start_time = end_time - timedelta(days=int(window[:-1]))
        elif window.endswith("m"):
            start_time = end_time - timedelta(days=int(window[:-1]) * 30)
        else:
            return jsonify({"error": "Invalid window format"}), 400

        # 2️ Fetch and aggregate ClusterMetrics by (cluster_id, cluster_name)
        rows = (
            session.query(ClusterMetrics)
            .filter(
                ClusterMetrics.user_id == user_id,
                ClusterMetrics.window_end > start_time,    
                ClusterMetrics.window_start < end_time,  
            )
            .all()
        )

        if not rows:
            return (
                jsonify(
                    {
                        "status": "success",
                        "data": {"clusters": [], "aggregated": empty_aggregated()},
                        "start_time": start_time.isoformat(),
                        "end_time": end_time.isoformat(),
                    }
                ),
                200,
            )

        aggregated_clusters = {}
        idle_cost_from_clusters = 0.0

        for row in rows:
            # Skip __idle__ clusters but track their cost separately
            if row.cluster_name == "__idle__":
                idle_cost_from_clusters += row.total_cost
                continue
            key = (row.cluster_id, row.cluster_name)
            if key not in aggregated_clusters:
                aggregated_clusters[key] = {
                    "id": row.cluster_id,
                    "name": row.cluster_name,
                    "unique_hash": row.unique_id,
                    "total_cost": 0.0,
                    "cpu_usage_percent_vals": [],
                    "memory_usage_percent_vals": [],
                    "total_efficiency_vals": [],
                }

            agg = aggregated_clusters[key]
            agg["total_cost"] += row.total_cost
            agg["cpu_usage_percent_vals"].append(row.cpu_usage_percent)
            agg["memory_usage_percent_vals"].append(row.memory_usage_percent)
            agg["total_efficiency_vals"].append(row.total_efficiency)

        # Finalize cluster averages
        for agg in aggregated_clusters.values():

            def avg(values):
                print("==========================================")
                print(values)
                print("==========================================")
                return sum(values) / len(values) if values else 0.0

            agg["cpu_usage_percent"] = avg(agg.pop("cpu_usage_percent_vals"))
            agg["memory_usage_percent"] = avg(agg.pop("memory_usage_percent_vals"))
            agg["total_efficiency"] = avg(agg.pop("total_efficiency_vals"))

        results = []
        aggregated_global = init_aggregated()

        # Process each aggregated cluster (fetch node & pod metrics)
        for cluster_data in aggregated_clusters.values():
            cluster_id = cluster_data["id"]

            # Fetch NodeMetrics for this cluster
            node_metrics = (
                session.query(NodeMetrics)
                .filter(
                    NodeMetrics.user_id == user_id,
                    NodeMetrics.cluster_id == cluster_id,
                    NodeMetrics.window_end > start_time,    
                    NodeMetrics.window_start < end_time,  
                    
                )
                .all()
            )

            # Fetch PodMetrics for this cluster
            pod_metrics = (
                session.query(PodMetrics)
                .filter(
                    PodMetrics.user_id == user_id,
                    PodMetrics.cluster_id == cluster_id,
                    PodMetrics.end_time > start_time,    
                    PodMetrics.start_time < end_time,  
                   
                )
                .all()
            )

            # Aggregate node & pod metrics
            node_data = aggregate_node_metrics(node_metrics)
            pod_data = aggregate_pod_metrics(pod_metrics)

            # Idle cost = cost from node metrics + "__idle__" cost from clusters
            cluster_idle_cost = sum(
                n.cpu_cost_idle + n.ram_cost_idle for n in node_metrics
            )

            results.append(
                {
                    "id": cluster_id,
                    "name": cluster_data["name"],
                    "unique_hash": cluster_data["unique_hash"],
                    "cluster": {
                        "totalCost": cluster_data["total_cost"],
                        "efficiency": cluster_data["total_efficiency"],
                        "cpuUsage": cluster_data["cpu_usage_percent"],
                        "memoryUsage": cluster_data["memory_usage_percent"],
                    },
                    "node": node_data,
                    "pod": pod_data,
                    "idleCost": cluster_idle_cost,
                }
            )

            update_global_aggregated(
                aggregated_global,
                {
                    "totalCost": cluster_data["total_cost"],
                    "efficiency": cluster_data["total_efficiency"],
                    "cpuUsage": cluster_data["cpu_usage_percent"],
                    "memoryUsage": cluster_data["memory_usage_percent"],
                },
                node_data,
                pod_data,
                cluster_idle_cost,
            )

        # Add "__idle__" cluster cost to global idle
        aggregated_global["idleCost"] = (
            aggregated_global.get("idleCost", 0.0) + idle_cost_from_clusters
        )
        aggregated_global["totalCost"] += aggregated_global["idleCost"]

        finalize_aggregated(aggregated_global)

        return (
            jsonify(
                {
                    "status": "success",
                    "data": {"clusters": results, "aggregated": aggregated_global},
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error in dashboard_summary: {str(e)}")
        return jsonify({"status": "failed", "error": str(e)}), 500
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
        print("kjhghjkl;'-------------------------cluster_i", cluster_id , snapshots , "---------------END-----------------")
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
                                            "cluster_relation_id":cluster_obj.id,
                                            "cluster_id": cluster_id, 
                                            "node_name": node_allocation.get(
                                                "node_name"
                                            ),
                                            "cluster_name": node_allocation.get(
                                                "cluster_name"
                                            ),
                                            "namespace": node_allocation.get(
                                                "namespace"
                                            ),
                                            "deployment_name": node_allocation.get(
                                                "deployment_name"
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
                                        print(
                                            "within node'-------------------------cluster_i",
                                            cluster_id,
                                        )

                                        node_obj = NodeMetrics(**node_entry)
                                        session.add(node_obj)
                                        session.flush()  # This assigns the ID to node_obj
                                        results["node_metrics"] += 1

                                        # Process pod data if available
                                        pod_data = node_allocation.get("pod_data", {})
                                        if pod_data and pod_data.get("data"):
                                            pod_sets = pod_data["data"].get("sets", [])
                                            print(
                                                "within node'-------------------------cluster_i",
                                                cluster_id,
                                            )

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
                                                            "deployment_name": pod_allocation.get(
                                                                "deployment_name"
                                                            ),
                                                            "node_name": pod_allocation.get(
                                                                "node_name"
                                                            ),
                                                            "start_time": pod_allocation.get(
                                                                "start_time"
                                                            ),
                                                            "end_time": pod_allocation.get(
                                                                "end_time"
                                                            ),
                                                            "timestamp": node_allocation.get(
                                                                "timestamp"
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
                "id": 1,
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
                "id": 2,
                "status": 1,
                "terraform_file": "terraform_123.tfvars",
                "updated_at": "2025-08-12T11:40:47.650507",
                "user_id": 1,
            },
        ]
        return jsonify({"message": "Metrics ingested", "data": data}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500


from datetime import datetime, timedelta
from flask import jsonify


def empty_aggregated():
    return {
        "totalCost": 0,
        "avgEfficiency": 0,
        "avgCpuUsage": 0,
        "avgMemoryUsage": 0,
        "clusterCount": 0,
        "totalNodes": 0,
        "healthyNodes": 0,
        "warningNodes": 0,
        "nodeAvgEfficiency": 0,
        "nodeAvgCpuUsage": 0,
        "totalPods": 0,
        "runningPods": 0,
        "idlePods": 0,
        "totalPodCost": 0,
        "idleCost": 0,
    }


def init_aggregated():
    return empty_aggregated()


def aggregate_node_metrics(nodes):
    data = {
        "totalNodes": len(nodes),
        "healthyNodes": 0,
        "warningNodes": 0,
        "totalCost": 0,
        "avgEfficiency": 0,
        "avgCpuUsage": 0,
    }

    if not nodes:
        return data

    eff_sum, cpu_sum = 0, 0
    mismatchCount = 0
    for node in nodes:
        print(node.node_name)

        if node.node_name == "__idle__" or node.node_name == "__unallocated__":
            mismatchCount += 1
            continue
        data["totalCost"] += node.total_cost
        eff_sum += node.total_efficiency
        if node.total_efficiency > 0.2:
            data["healthyNodes"] += 1
        elif node.total_efficiency > 0:
            data["warningNodes"] += 1
        if node.cpu_core_request_average > 0:
            cpu_sum += (
                node.cpu_core_usage_average / node.cpu_core_request_average
            ) * 100
    print("mismatchCountmismatchCountmismatchCount", mismatchCount)
    data["avgEfficiency"] = eff_sum / (len(nodes) - mismatchCount)
    data["avgCpuUsage"] = cpu_sum / (len(nodes) - mismatchCount)
    return data


def aggregate_pod_metrics(pods):

    idle_pods = 0
    data = {"totalPods": 0, "runningPods": 0, "idlePods": 0, "totalCost": 0}
    for pod in pods:
        if pod.name == "__idle__":
            idle_pods += 1
            continue
        data["totalPods"] += 1
        data["totalCost"] += pod.total_cost
        if pod.total_cost > 0:
            data["runningPods"] += 1
        else:
            data["idlePods"] += 1
    print(
        "******************************************************************************"
    )
    print(idle_pods)
    print(
        "******************************************************************************"
    )
    return data


def update_global_aggregated(agg, cluster, node, pod, idle_cost):
    agg["totalCost"] += cluster.get("totalCost", 0)
    agg["avgEfficiency"] += cluster.get("efficiency", 0)
    agg["avgCpuUsage"] += cluster.get("cpuUsage", 0)
    agg["avgMemoryUsage"] += cluster.get("memoryUsage", 0)
    agg["clusterCount"] += 1

    agg["totalNodes"] += node.get("totalNodes", 0)
    agg["healthyNodes"] += node.get("healthyNodes", 0)
    agg["warningNodes"] += node.get("warningNodes", 0)
    agg["nodeAvgEfficiency"] += node.get("avgEfficiency", 0)
    agg["nodeAvgCpuUsage"] += node.get("avgCpuUsage", 0)

    agg["totalPods"] += pod.get("totalPods", 0)
    agg["runningPods"] += pod.get("runningPods", 0)
    agg["idlePods"] += pod.get("idlePods", 0)
    agg["totalPodCost"] += pod.get("totalCost", 0)
    agg["idleCost"] += idle_cost


def finalize_aggregated(agg):
    if agg["clusterCount"] > 0:
        agg["avgEfficiency"] /= agg["clusterCount"]
        agg["avgCpuUsage"] /= agg["clusterCount"]
        agg["avgMemoryUsage"] /= agg["clusterCount"]
    if agg["totalNodes"] > 0:
        agg["nodeAvgEfficiency"] /= agg["clusterCount"]
        agg["nodeAvgCpuUsage"] /= agg["clusterCount"]
