# clusters/routes.py - Updated with new endpoints

from flask import Blueprint, jsonify, Response, request
from models.model import ClusterMetrics, NodeMetrics, PodMetrics
from models.model import db_manager
import os

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


# @clusters_bp.route("/clusters/status", methods=["GET"])
# def cluster_status():
#     """
#     Get cluster status and metrics
#     Query parameters:
#     - window: Time window (1h, 6h, 24h, 7d, 30d) - default: 7d
#     - force_refresh: Force API call instead of using cache (true/false) - default: false
#     """
#     return jsonify(get_cluster_status())


# @clusters_bp.route("/all", methods=["GET"])
# def summary():
#     """
#     Unified API endpoint for all metrics based on aggregation type
#     Query parameters:
#     - window: Time window (1h, 6h, 24h, 7d, 30d) - default: 7d
#     - aggregate: Aggregation type (cluster, node, pod, controller, namespace) - default: controller
#     - chartType: Chart type (costovertime, etc.) - default: costovertime
#     - force_refresh: Force API call instead of using cache (true/false) - default: false
#     """
#     return jsonify(summaryApi())


@clusters_bp.route("/get_pod_details", methods=["GET"])
def getPodDetail():
    # ...existing code...
    pass


# ================================
# Bulk Metrics Ingestion Endpoint
# ================================
@clusters_bp.route("/fetchMetrics", methods=["POST"])
def fetch_metrics():
    """
    Bulk insert metrics for clusters, nodes, and pods.
    Expects JSON with keys: cluster_metrics, node_metrics, pod_metrics (each a list of dicts).
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    results = {"cluster_metrics": 0, "node_metrics": 0, "pod_metrics": 0, "errors": []}
    session = db_manager.get_session()
    try:
        # ClusterMetrics
        cluster_metrics = data.get("cluster_metrics", [])
        for entry in cluster_metrics:
            try:
                obj = ClusterMetrics(**entry)
                session.add(obj)
                results["cluster_metrics"] += 1
            except Exception as e:
                results["errors"].append(f"ClusterMetrics: {str(e)}")

        # NodeMetrics
        node_metrics = data.get("node_metrics", [])
        for entry in node_metrics:
            try:
                obj = NodeMetrics(**entry)
                session.add(obj)
                results["node_metrics"] += 1
            except Exception as e:
                results["errors"].append(f"NodeMetrics: {str(e)}")

        # PodMetrics
        pod_metrics = data.get("pod_metrics", [])
        for entry in pod_metrics:
            try:
                obj = PodMetrics(**entry)
                session.add(obj)
                results["pod_metrics"] += 1
            except Exception as e:
                results["errors"].append(f"PodMetrics: {str(e)}")

        session.commit()
        return jsonify({"message": "Metrics ingested", **results}), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
   


# @clusters_bp.route("/dashboard/summary", methods=["GET"])
# def dashboard_summary():
#     """
#     Dashboard summary: aggregated metrics for all instances with backend calculations
#     """
#     window = request.args.get("window", "7d")
#     force_refresh = request.args.get("force_refresh", "false").lower() == "true"
#     offset = request.args.get("offset", "0")
#     limit = request.args.get("limit", "0")

#     try:
#         instances = kubecost_service._list_instances()
#         if not instances:
#             return (
#                 jsonify(
#                     {
#                         "status": "success",
#                         "data": {
#                             "clusters": [],
#                             "aggregated": {
#                                 "totalCost": 0,
#                                 "avgEfficiency": 0,
#                                 "avgCpuUsage": 0,
#                                 "avgMemoryUsage": 0,
#                                 "clusterCount": 0,
#                                 "totalNodes": 0,
#                                 "healthyNodes": 0,
#                                 "warningNodes": 0,
#                                 "totalPods": 0,
#                                 "runningPods": 0,
#                                 "idlePods": 0,
#                                 "idleCost": 0,
#                             },
#                         },
#                     }
#                 ),
#                 200,
#             )

#         cluster_results = []

#         # Aggregation variables
#         total_cost = 0
#         total_efficiency = 0
#         total_cpu_usage = 0
#         total_memory_usage = 0
#         cluster_count = 0

#         total_nodes = 0
#         healthy_nodes = 0
#         warning_nodes = 0
#         node_efficiency_sum = 0
#         node_cpu_usage_sum = 0
#         node_count = 0

#         total_pods = 0
#         running_pods = 0
#         idle_pods = 0
#         total_pod_cost = 0

#         total_idle_cost = 0

#         def process_instance(instance):
#             domain = instance.unique_hash

#             cluster_data = kubecost_service.get_cluster_data(
#                 window=window,
#                 force_refresh=force_refresh,
#                 offset=offset,
#                 limit=limit,
#                 domain=domain,
#             )

#             node_data = kubecost_service.get_node_data(
#                 window=window,
#                 force_refresh=force_refresh,
#                 offset=offset,
#                 limit=limit,
#                 domain=domain,
#             )

#             pod_data = kubecost_service.get_pod_data(
#                 window=window,
#                 aggregate="pod",
#                 force_refresh=force_refresh,
#                 offset=offset,
#                 limit=limit,
#                 domain=domain,
#             )

#             # Process cluster metrics
#             cluster_metrics = {}
#             if cluster_data.get("data", {}).get("data", {}).get("sets"):
#                 allocations = cluster_data["data"]["data"]["sets"][0].get(
#                     "allocations", {}
#                 )
#                 if allocations:
#                     cluster = list(allocations.values())[0]
#                     cluster_metrics = {
#                         "totalCost": cluster.get("totalCost", 0),
#                         "efficiency": cluster.get("totalEfficiency", 0),
#                         "cpuUsage": (
#                             (
#                                 cluster.get("cpuCoreUsageAverage", 0)
#                                 / cluster.get("cpuCoreRequestAverage", 1)
#                             )
#                             * 100
#                             if cluster.get("cpuCoreRequestAverage", 0) > 0
#                             else 0
#                         ),
#                         "memoryUsage": (
#                             (
#                                 cluster.get("ramByteUsageAverage", 0)
#                                 / cluster.get("ramByteRequestAverage", 1)
#                             )
#                             * 100
#                             if cluster.get("ramByteRequestAverage", 0) > 0
#                             else 0
#                         ),
#                     }

#             # Process node metrics
#             node_metrics = {
#                 "totalNodes": 0,
#                 "healthyNodes": 0,
#                 "warningNodes": 0,
#                 "totalCost": 0,
#                 "avgEfficiency": 0,
#                 "avgCpuUsage": 0,
#             }
#             if node_data.get("data", {}).get("data", {}).get("sets"):
#                 allocations = node_data["data"]["data"]["sets"][0].get(
#                     "allocations", {}
#                 )
#                 nodes = {k: v for k, v in allocations.items() if not k.startswith("__")}

#                 node_metrics["totalNodes"] = len(nodes)
#                 efficiency_sum = 0
#                 cpu_usage_sum = 0

#                 for node in nodes.values():
#                     node_metrics["totalCost"] += node.get("totalCost", 0)
#                     efficiency = node.get("totalEfficiency", 0)
#                     efficiency_sum += efficiency

#                     if efficiency > 0.2:
#                         node_metrics["healthyNodes"] += 1
#                     elif efficiency > 0:
#                         node_metrics["warningNodes"] += 1

#                     if node.get("cpuCoreRequestAverage", 0) > 0:
#                         cpu_usage_sum += (
#                             node.get("cpuCoreUsageAverage", 0)
#                             / node.get("cpuCoreRequestAverage", 1)
#                         ) * 100

#                 if len(nodes) > 0:
#                     node_metrics["avgEfficiency"] = efficiency_sum / len(nodes)
#                     node_metrics["avgCpuUsage"] = cpu_usage_sum / len(nodes)

#             # Process pod metrics
#             pod_metrics = {
#                 "totalPods": 0,
#                 "runningPods": 0,
#                 "idlePods": 0,
#                 "totalCost": 0,
#             }
#             if pod_data.get("data", {}).get("data", {}).get("sets"):
#                 allocations = pod_data["data"]["data"]["sets"][0].get("allocations", {})
#                 pods = {k: v for k, v in allocations.items() if not k.startswith("__")}

#                 pod_metrics["totalPods"] = len(pods)

#                 for pod in pods.values():
#                     cost = pod.get("totalCost", 0)
#                     pod_metrics["totalCost"] += cost

#                     if cost > 0:
#                         pod_metrics["runningPods"] += 1
#                     else:
#                         pod_metrics["idlePods"] += 1

#             # Get idle cost
#             idle_cost = 0
#             if node_data.get("data", {}).get("data", {}).get("sets"):
#                 allocations = node_data["data"]["data"]["sets"][0].get(
#                     "allocations", {}
#                 )
#                 if "__idle__" in allocations:
#                     idle_cost = allocations["__idle__"].get("totalCost", 0)

#             return {
#                 "id": instance.id,
#                 "name": instance.name,
#                 "unique_hash": domain,
#                 "cluster": cluster_metrics,
#                 "node": node_metrics,
#                 "pod": pod_metrics,
#                 "idleCost": idle_cost,
#                 "raw_data": {
#                     "cluster": cluster_data,
#                     "node": node_data,
#                     "pod": pod_data,
#                 },
#             }

#         # Run instance processing in parallel
#         with ThreadPoolExecutor(max_workers=5) as executor:
#             future_to_instance = {
#                 executor.submit(process_instance, inst): inst for inst in instances
#             }
#             for future in as_completed(future_to_instance):
#                 try:
#                     result = future.result()
#                     cluster_results.append(result)

#                     # Aggregate metrics
#                     if "error" not in result:
#                         # Cluster aggregation
#                         if result.get("cluster"):
#                             total_cost += result["cluster"].get("totalCost", 0)
#                             total_efficiency += result["cluster"].get("efficiency", 0)
#                             total_cpu_usage += result["cluster"].get("cpuUsage", 0)
#                             total_memory_usage += result["cluster"].get(
#                                 "memoryUsage", 0
#                             )
#                             cluster_count += 1

#                         # Node aggregation
#                         if result.get("node"):
#                             total_nodes += result["node"].get("totalNodes", 0)
#                             healthy_nodes += result["node"].get("healthyNodes", 0)
#                             warning_nodes += result["node"].get("warningNodes", 0)
#                             node_efficiency_sum += result["node"].get(
#                                 "avgEfficiency", 0
#                             )
#                             node_cpu_usage_sum += result["node"].get("avgCpuUsage", 0)
#                             if result["node"].get("totalNodes", 0) > 0:
#                                 node_count += 1

#                         # Pod aggregation
#                         if result.get("pod"):
#                             total_pods += result["pod"].get("totalPods", 0)
#                             running_pods += result["pod"].get("runningPods", 0)
#                             idle_pods += result["pod"].get("idlePods", 0)
#                             total_pod_cost += result["pod"].get("totalCost", 0)

#                         # Idle cost
#                         total_idle_cost += result.get("idleCost", 0)

#                 except Exception as e:
#                     inst = future_to_instance[future]
#                     cluster_results.append(
#                         {
#                             "id": inst.id,
#                             "name": inst.name,
#                             "unique_hash": inst.unique_hash,
#                             "error": str(e),
#                         }
#                     )

#         # Calculate aggregated metrics
#         aggregated = {
#             "totalCost": total_cost,
#             "avgEfficiency": (
#                 total_efficiency / cluster_count if cluster_count > 0 else 0
#             ),
#             "avgCpuUsage": total_cpu_usage / cluster_count if cluster_count > 0 else 0,
#             "avgMemoryUsage": (
#                 total_memory_usage / cluster_count if cluster_count > 0 else 0
#             ),
#             "clusterCount": cluster_count,
#             "totalNodes": total_nodes,
#             "healthyNodes": healthy_nodes,
#             "warningNodes": warning_nodes,
#             "nodeAvgEfficiency": (
#                 node_efficiency_sum / node_count if node_count > 0 else 0
#             ),
#             "nodeAvgCpuUsage": node_cpu_usage_sum / node_count if node_count > 0 else 0,
#             "totalPods": total_pods,
#             "runningPods": running_pods,
#             "idlePods": idle_pods,
#             "totalPodCost": total_pod_cost,
#             "idleCost": total_idle_cost,
#         }

#         return (
#             jsonify(
#                 {
#                     "status": "success",
#                     "data": {"clusters": cluster_results, "aggregated": aggregated},
#                 }
#             ),
#             200,
#         )

#     except Exception as e:
#         return jsonify({"status": "failed", "error": str(e)}), 500
