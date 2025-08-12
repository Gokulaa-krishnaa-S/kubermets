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
from concurrent.futures import ThreadPoolExecutor, as_completed

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
    Dashboard summary: aggregated metrics for all instances with backend calculations
    """
    window = request.args.get("window", "7d")
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    offset = request.args.get("offset", "0")
    limit = request.args.get("limit", "0")

    try:
        instances = kubecost_service._list_instances()
        if not instances:
            return (
                jsonify(
                    {
                        "status": "success",
                        "data": {
                            "clusters": [],
                            "aggregated": {
                                "totalCost": 0,
                                "avgEfficiency": 0,
                                "avgCpuUsage": 0,
                                "avgMemoryUsage": 0,
                                "clusterCount": 0,
                                "totalNodes": 0,
                                "healthyNodes": 0,
                                "warningNodes": 0,
                                "totalPods": 0,
                                "runningPods": 0,
                                "idlePods": 0,
                                "idleCost": 0,
                            },
                        },
                    }
                ),
                200,
            )

        cluster_results = []

        # Aggregation variables
        total_cost = 0
        total_efficiency = 0
        total_cpu_usage = 0
        total_memory_usage = 0
        cluster_count = 0

        total_nodes = 0
        healthy_nodes = 0
        warning_nodes = 0
        node_efficiency_sum = 0
        node_cpu_usage_sum = 0
        node_count = 0

        total_pods = 0
        running_pods = 0
        idle_pods = 0
        total_pod_cost = 0

        total_idle_cost = 0

        def process_instance(instance):
            domain = instance.unique_hash

            cluster_data = kubecost_service.get_cluster_data(
                window=window,
                force_refresh=force_refresh,
                offset=offset,
                limit=limit,
                domain=domain,
            )

            node_data = kubecost_service.get_node_data(
                window=window,
                force_refresh=force_refresh,
                offset=offset,
                limit=limit,
                domain=domain,
            )

            pod_data = kubecost_service.get_pod_data(
                window=window,
                aggregate="pod",
                force_refresh=force_refresh,
                offset=offset,
                limit=limit,
                domain=domain,
            )

            # Process cluster metrics
            cluster_metrics = {}
            if cluster_data.get("data", {}).get("data", {}).get("sets"):
                allocations = cluster_data["data"]["data"]["sets"][0].get(
                    "allocations", {}
                )
                if allocations:
                    cluster = list(allocations.values())[0]
                    cluster_metrics = {
                        "totalCost": cluster.get("totalCost", 0),
                        "efficiency": cluster.get("totalEfficiency", 0),
                        "cpuUsage": (
                            (
                                cluster.get("cpuCoreUsageAverage", 0)
                                / cluster.get("cpuCoreRequestAverage", 1)
                            )
                            * 100
                            if cluster.get("cpuCoreRequestAverage", 0) > 0
                            else 0
                        ),
                        "memoryUsage": (
                            (
                                cluster.get("ramByteUsageAverage", 0)
                                / cluster.get("ramByteRequestAverage", 1)
                            )
                            * 100
                            if cluster.get("ramByteRequestAverage", 0) > 0
                            else 0
                        ),
                    }

            # Process node metrics
            node_metrics = {
                "totalNodes": 0,
                "healthyNodes": 0,
                "warningNodes": 0,
                "totalCost": 0,
                "avgEfficiency": 0,
                "avgCpuUsage": 0,
            }
            if node_data.get("data", {}).get("data", {}).get("sets"):
                allocations = node_data["data"]["data"]["sets"][0].get(
                    "allocations", {}
                )
                nodes = {k: v for k, v in allocations.items() if not k.startswith("__")}

                node_metrics["totalNodes"] = len(nodes)
                efficiency_sum = 0
                cpu_usage_sum = 0

                for node in nodes.values():
                    node_metrics["totalCost"] += node.get("totalCost", 0)
                    efficiency = node.get("totalEfficiency", 0)
                    efficiency_sum += efficiency

                    if efficiency > 0.2:
                        node_metrics["healthyNodes"] += 1
                    elif efficiency > 0:
                        node_metrics["warningNodes"] += 1

                    if node.get("cpuCoreRequestAverage", 0) > 0:
                        cpu_usage_sum += (
                            node.get("cpuCoreUsageAverage", 0)
                            / node.get("cpuCoreRequestAverage", 1)
                        ) * 100

                if len(nodes) > 0:
                    node_metrics["avgEfficiency"] = efficiency_sum / len(nodes)
                    node_metrics["avgCpuUsage"] = cpu_usage_sum / len(nodes)

            # Process pod metrics
            pod_metrics = {
                "totalPods": 0,
                "runningPods": 0,
                "idlePods": 0,
                "totalCost": 0,
            }
            if pod_data.get("data", {}).get("data", {}).get("sets"):
                allocations = pod_data["data"]["data"]["sets"][0].get("allocations", {})
                pods = {k: v for k, v in allocations.items() if not k.startswith("__")}

                pod_metrics["totalPods"] = len(pods)

                for pod in pods.values():
                    cost = pod.get("totalCost", 0)
                    pod_metrics["totalCost"] += cost

                    if cost > 0:
                        pod_metrics["runningPods"] += 1
                    else:
                        pod_metrics["idlePods"] += 1

            # Get idle cost
            idle_cost = 0
            if node_data.get("data", {}).get("data", {}).get("sets"):
                allocations = node_data["data"]["data"]["sets"][0].get(
                    "allocations", {}
                )
                if "__idle__" in allocations:
                    idle_cost = allocations["__idle__"].get("totalCost", 0)

            return {
                "id": instance.id,
                "name": instance.name,
                "unique_hash": domain,
                "cluster": cluster_metrics,
                "node": node_metrics,
                "pod": pod_metrics,
                "idleCost": idle_cost,
                "raw_data": {
                    "cluster": cluster_data,
                    "node": node_data,
                    "pod": pod_data,
                },
            }

        # Run instance processing in parallel
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_instance = {
                executor.submit(process_instance, inst): inst for inst in instances
            }
            for future in as_completed(future_to_instance):
                try:
                    result = future.result()
                    cluster_results.append(result)

                    # Aggregate metrics
                    if "error" not in result:
                        # Cluster aggregation
                        if result.get("cluster"):
                            total_cost += result["cluster"].get("totalCost", 0)
                            total_efficiency += result["cluster"].get("efficiency", 0)
                            total_cpu_usage += result["cluster"].get("cpuUsage", 0)
                            total_memory_usage += result["cluster"].get(
                                "memoryUsage", 0
                            )
                            cluster_count += 1

                        # Node aggregation
                        if result.get("node"):
                            total_nodes += result["node"].get("totalNodes", 0)
                            healthy_nodes += result["node"].get("healthyNodes", 0)
                            warning_nodes += result["node"].get("warningNodes", 0)
                            node_efficiency_sum += result["node"].get(
                                "avgEfficiency", 0
                            )
                            node_cpu_usage_sum += result["node"].get("avgCpuUsage", 0)
                            if result["node"].get("totalNodes", 0) > 0:
                                node_count += 1

                        # Pod aggregation
                        if result.get("pod"):
                            total_pods += result["pod"].get("totalPods", 0)
                            running_pods += result["pod"].get("runningPods", 0)
                            idle_pods += result["pod"].get("idlePods", 0)
                            total_pod_cost += result["pod"].get("totalCost", 0)

                        # Idle cost
                        total_idle_cost += result.get("idleCost", 0)

                except Exception as e:
                    inst = future_to_instance[future]
                    cluster_results.append(
                        {
                            "id": inst.id,
                            "name": inst.name,
                            "unique_hash": inst.unique_hash,
                            "error": str(e),
                        }
                    )

        # Calculate aggregated metrics
        aggregated = {
            "totalCost": total_cost,
            "avgEfficiency": (
                total_efficiency / cluster_count if cluster_count > 0 else 0
            ),
            "avgCpuUsage": total_cpu_usage / cluster_count if cluster_count > 0 else 0,
            "avgMemoryUsage": (
                total_memory_usage / cluster_count if cluster_count > 0 else 0
            ),
            "clusterCount": cluster_count,
            "totalNodes": total_nodes,
            "healthyNodes": healthy_nodes,
            "warningNodes": warning_nodes,
            "nodeAvgEfficiency": (
                node_efficiency_sum / node_count if node_count > 0 else 0
            ),
            "nodeAvgCpuUsage": node_cpu_usage_sum / node_count if node_count > 0 else 0,
            "totalPods": total_pods,
            "runningPods": running_pods,
            "idlePods": idle_pods,
            "totalPodCost": total_pod_cost,
            "idleCost": total_idle_cost,
        }

        return (
            jsonify(
                {
                    "status": "success",
                    "data": {"clusters": cluster_results, "aggregated": aggregated},
                }
            ),
            200,
        )

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


@clusters_bp.route("/instance/<int:instance_id>", methods=["PUT"])
def update_instance(instance_id):
    """Update an existing Kubernetes instance"""
    try:
        data = request.get_json()

        if not data:
            return {"error": "No data provided."}, 400

        # Perform the update
        updated_instance = kubecost_service._update_instance(instance_id, data)

        if not updated_instance:
            return {"error": "Instance not found."}, 404

        return {
            "message": "Instance updated successfully",
            "instance_id": updated_instance.id,
        }, 200

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
                "unique_hash": inst.unique_hash,
                "created_at": inst.created_at.isoformat(),
                "updated_at": inst.updated_at.isoformat(),
            }
            for inst in instances
        ]
        return {"instances": instance_list}, 200

    except Exception as e:
        return {"error": str(e)}, 500
