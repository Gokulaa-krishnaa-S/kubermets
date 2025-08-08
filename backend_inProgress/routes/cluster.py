# clusters/routes.py - Updated with new endpoints

from flask import Blueprint, jsonify, Response, request
from controllers.cluster_controller import (
    get_cluster_status,
    get_node_info,
    summaryApi,
    getPodDetails,
    get_cache_status,
    clear_cache,
    force_data_refresh,
)
from service.data_service import kubecost_service

clusters_bp = Blueprint("clusters", __name__, url_prefix="/v1")


@clusters_bp.route("/")
def index():
    return Response("Kubecost Monitoring API v1.0", status=200)


@clusters_bp.route("/health")
def health():
    return Response("OK", status=200)


@clusters_bp.route("/clusters/status", methods=["GET"])
def cluster_status():
    """
    Get cluster status and metrics
    Query parameters:
    - window: Time window (1h, 6h, 24h, 7d, 30d) - default: 7d
    - force_refresh: Force API call instead of using cache (true/false) - default: false
    """
    return jsonify(get_cluster_status())


@clusters_bp.route("/all", methods=["GET"])
def summary():
    """
    Unified API endpoint for all metrics based on aggregation type
    Query parameters:
    - window: Time window (1h, 6h, 24h, 7d, 30d) - default: 7d
    - aggregate: Aggregation type (cluster, node, pod, controller, namespace) - default: controller
    - chartType: Chart type (costovertime, etc.) - default: costovertime
    - force_refresh: Force API call instead of using cache (true/false) - default: false
    """
    return jsonify(summaryApi())


@clusters_bp.route("/get_pod_details", methods=["GET"])
def getPodDetail():
    """
    Get specific pod details
    Query parameters:
    - window: Time window - default: 7d
    - filterPods: Specific pod name to filter
    - force_refresh: Force API call instead of using cache (true/false) - default: false
    """
    return jsonify(getPodDetails())


@clusters_bp.route("/clusters/nodes", methods=["GET"])
def node_info():
    """
    Get node information and metrics
    Query parameters:
    - window: Time window - default: 24h
    - force_refresh: Force API call instead of using cache (true/false) - default: false
    """
    return jsonify(get_node_info())


# Cache management endpoints
@clusters_bp.route("/cache/status", methods=["GET"])
def cache_status():
    """Get cache status and statistics"""
    return jsonify(get_cache_status())


@clusters_bp.route("/cache/clear", methods=["POST"])
def clear_cache_endpoint():
    """Clear all cached data (admin endpoint)"""
    return jsonify(clear_cache())


@clusters_bp.route("/data/refresh", methods=["POST"])
def refresh_data():
    """Force refresh of all data from Kubecost API"""
    return jsonify(force_data_refresh())


# New aggregated endpoints for better frontend integration
@clusters_bp.route("/dashboard/summary", methods=["GET"])
def dashboard_summary():
    """
    Get dashboard summary with key metrics
    Returns aggregated data for dashboard overview
    """
    window = request.args.get("window", "7d")
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"

    try:

        # Get data from all sources
        cluster_data = kubecost_service.get_cluster_data(
            window=window, force_refresh=force_refresh
        )
        node_data = kubecost_service.get_node_data(
            window=window, force_refresh=force_refresh
        )
        pod_data = kubecost_service.get_pod_data(
            window=window, force_refresh=force_refresh
        )

        # Extract key metrics
        summary = {
            "status": "success",
            "window": window,
            "cluster": {
                "total_cost": 0,
                "cpu_cost": 0,
                "memory_cost": 0,
                "storage_cost": 0,
            },
            "nodes": {"active_count": 0, "total_cost": 0, "avg_efficiency": 0},
            "pods": {"active_count": 0, "total_cost": 0},
            "cached": False,
        }

        # Process cluster data
        if cluster_data.get("status") == "success" and cluster_data.get("data"):
            cluster_info = cluster_data["data"].get("data", [])
            if cluster_info:
                cluster_metrics = cluster_info[0]  # Assuming single cluster
                summary["cluster"] = {
                    "total_cost": cluster_metrics.get("totalCost", 0),
                    "cpu_cost": cluster_metrics.get("cpuCost", 0),
                    "memory_cost": cluster_metrics.get("ramCost", 0),
                    "storage_cost": cluster_metrics.get("pvCost", 0),
                }

        # Process node data
        if node_data.get("status") == "success" and node_data.get("data"):
            if isinstance(node_data["data"], dict) and "data" in node_data["data"]:
                node_list = node_data["data"]["data"]
                summary["nodes"]["active_count"] = len(node_list)
                summary["nodes"]["total_cost"] = sum(
                    node.get("totalCost", 0) for node in node_list
                )
                # Calculate average efficiency
                efficiencies = [
                    node.get("cpuEfficiency", 0)
                    for node in node_list
                    if node.get("cpuEfficiency")
                ]
                summary["nodes"]["avg_efficiency"] = (
                    sum(efficiencies) / len(efficiencies) if efficiencies else 0
                )

        # Process pod data
        if pod_data.get("status") == "success" and pod_data.get("data"):
            if isinstance(pod_data["data"], dict) and "data" in pod_data["data"]:
                pod_list = pod_data["data"]["data"]
                summary["pods"]["active_count"] = len(pod_list)
                summary["pods"]["total_cost"] = sum(
                    pod.get("totalCost", 0) for pod in pod_list
                )

        # Check if any data was cached
        summary["cached"] = any(
            [
                cluster_data.get("cached", False),
                node_data.get("cached", False),
                pod_data.get("cached", False),
            ]
        )

        return jsonify(summary)

    except Exception as e:
        return jsonify({"status": "failed", "error": str(e)}), 500


@clusters_bp.route("/instance", methods=["POST"])
def create_instance():
    """Create a new Kubernetes instance"""
    try:
        data = request.get_json()

        required_fields = ["name", "api_url"]
        for field in required_fields:
            if field not in data:
                return {"error": f"'{field}' is required."}, 400

        instance = kubecost_service._create_instance(data)
        return {
            "message": "Instance created successfully",
            "instance_id": instance.id,
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@clusters_bp.route("/instance", methods=["GET"])
def list_instances():
    """List all Kubernetes instances"""
    try:
        instances = kubecost_service._list_instances()
        instance_list = [
            {
                "id": inst.id,
                "name": inst.name,
                "description": inst.description,
                "api_url": inst.api_url,
                "client_name": inst.client_name,
                "status": inst.status,
                "created_at": inst.created_at.isoformat(),
                "updated_at": inst.updated_at.isoformat(),
            }
            for inst in instances
        ]
        return {"instances": instance_list}, 200

    except Exception as e:
        return {"error": str(e)}, 500
