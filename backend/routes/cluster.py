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
    Bulk insert metrics for clusters, nodes, and pods from nested JSON structure.
    Expects JSON with user_id, cluster_id, and snapshots array.
    Creates proper relationships between cluster -> nodes -> pods.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    results = {"cluster_metrics": 0, "node_metrics": 0, "pod_metrics": 0, "errors": []}
    session = db_manager.get_session()
    
    try:
        # Extract snapshots from the JSON
        snapshots = data.get("snapshots", [])
        
        for snapshot in snapshots:
            allocations = snapshot.get("allocations", {})
            window_info = snapshot.get("window", {})
            
            for allocation_key, allocation_data in allocations.items():
                cluster_obj = None
                
                try:
                    # Process all allocations including idle for cluster metrics
                    # Create ClusterMetrics entry
                    cluster_entry = {
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
                        "load_balancer_cost": allocation_data.get("load_balancer_cost", 0.0),
                        "external_cost": allocation_data.get("external_cost", 0.0),
                        "shared_cost": allocation_data.get("shared_cost", 0.0),
                        "cpu_core_request_average": allocation_data.get("cpu_core_request_average", 0.0),
                        "cpu_core_usage_average": allocation_data.get("cpu_core_usage_average", 0.0),
                        "ram_byte_request_average": allocation_data.get("ram_byte_request_average", 0.0),
                        "ram_byte_usage_average": allocation_data.get("ram_byte_usage_average", 0.0),
                        "gpu_request_average": allocation_data.get("gpu_request_average", 0.0),
                        "gpu_usage_average": allocation_data.get("gpu_usage_average", 0.0),
                        "total_efficiency": allocation_data.get("total_efficiency", 0.0),
                        "cpu_usage_percent": allocation_data.get("cpu_usage_percent", 0.0),
                        "memory_usage_percent": allocation_data.get("memory_usage_percent", 0.0),
                        "memory_gb_used": allocation_data.get("memory_gb_used", 0.0),
                        "memory_gb_requested": allocation_data.get("memory_gb_requested", 0.0),
                        "efficiency_percent": allocation_data.get("efficiency_percent", 0.0),
                        "cluster_status": allocation_data.get("cluster_status"),
                        "cluster_version": allocation_data.get("cluster_version"),
                        "node_count": allocation_data.get("node_count"),
                        "pod_count": allocation_data.get("pod_count"),
                        "efficiency_category": allocation_data.get("efficiency_category"),
                        "is_idle_allocation": allocation_data.get("is_idle_allocation", False),
                        "query_params": allocation_data.get("query_params"),
                        "fetch_timestamp": allocation_data.get("fetch_timestamp"),
                        # "raw_api_response": allocation_data  # Store the full allocation data
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
                                
                                for node_key, node_allocation in node_allocations.items():
                                    node_obj = None
                                    
                                    try:
                                        # Create NodeMetrics entry with cluster_id foreign key
                                        node_entry = {
                                            "cluster_id": cluster_obj.id,  # Foreign key to cluster
                                            "node_name": node_allocation.get("node_name"),
                                            "cluster_name": node_allocation.get("cluster_name"),
                                            "timestamp": node_allocation.get("timestamp"),
                                            "window_start": node_allocation.get("window_start"),
                                            "window_end": node_allocation.get("window_end"),
                                            "window_duration": node_allocation.get("window_duration"),
                                            "total_cost": node_allocation.get("total_cost", 0.0),
                                            "cpu_cost": node_allocation.get("cpu_cost", 0.0),
                                            "cpu_cost_idle": node_allocation.get("cpu_cost_idle", 0.0),
                                            "ram_cost": node_allocation.get("ram_cost", 0.0),
                                            "ram_cost_idle": node_allocation.get("ram_cost_idle", 0.0),
                                            "pv_cost": node_allocation.get("pv_cost", 0.0),
                                            "network_cost": node_allocation.get("network_cost", 0.0),
                                            "gpu_cost": node_allocation.get("gpu_cost", 0.0),
                                            "gpu_cost_idle": node_allocation.get("gpu_cost_idle", 0.0),
                                            "load_balancer_cost": node_allocation.get("load_balancer_cost", 0.0),
                                            "external_cost": node_allocation.get("external_cost", 0.0),
                                            "shared_cost": node_allocation.get("shared_cost", 0.0),
                                            "cpu_core_request_average": node_allocation.get("cpu_core_request_average", 0.0),
                                            "cpu_core_usage_average": node_allocation.get("cpu_core_usage_average", 0.0),
                                            "ram_byte_request_average": node_allocation.get("ram_byte_request_average", 0.0),
                                            "ram_byte_usage_average": node_allocation.get("ram_byte_usage_average", 0.0),
                                            "gpu_request_average": node_allocation.get("gpu_request_average", 0.0),
                                            "gpu_usage_average": node_allocation.get("gpu_usage_average", 0.0),
                                            "total_efficiency": node_allocation.get("total_efficiency", 0.0),
                                            "cpu_usage_percent": node_allocation.get("cpu_usage_percent", 0.0),
                                            "memory_usage_percent": node_allocation.get("memory_usage_percent", 0.0),
                                            "memory_gb_used": node_allocation.get("memory_gb_used", 0.0),
                                            "memory_gb_requested": node_allocation.get("memory_gb_requested", 0.0),
                                            "efficiency_percent": node_allocation.get("efficiency_percent", 0.0),
                                            "node_status": node_allocation.get("node_status"),
                                            "node_health_score": node_allocation.get("node_health_score"),
                                            "node_instance_type": node_allocation.get("node_instance_type"),
                                            "node_zone": node_allocation.get("node_zone"),
                                            "is_idle_allocation": node_allocation.get("is_idle_allocation", False),
                                            "is_unallocated": node_allocation.get("is_unallocated", False),
                                            "is_system_allocation": node_allocation.get("is_system_allocation", False),
                                            "first_seen": node_allocation.get("first_seen"),
                                            "last_seen": node_allocation.get("last_seen"),
                                            "is_active": node_allocation.get("is_active", True)
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
                                                pod_allocations = pod_set.get("allocations", {})
                                                
                                                for pod_key, pod_allocation in pod_allocations.items():
                                                    try:
                                                        # Create PodMetrics entry with node_id foreign key
                                                        pod_entry = {
                                                            "node_id": node_obj.id,  # Foreign key to node
                                                            "key": pod_allocation.get("key"),
                                                            "namespace": pod_allocation.get("namespace"),
                                                            "name": pod_allocation.get("name"),
                                                            "start_time": pod_allocation.get("start_time"),
                                                            "end_time": pod_allocation.get("end_time"),
                                                            "window": pod_allocation.get("window"),
                                                            "cpu_core_usage_average": pod_allocation.get("cpu_core_usage_average", 0.0),
                                                            "cpu_core_request_average": pod_allocation.get("cpu_core_request_average", 0.0),
                                                            "cpu_cost": pod_allocation.get("cpu_cost", 0.0),
                                                            "ram_byte_usage_average": pod_allocation.get("ram_byte_usage_average", 0.0),
                                                            "ram_byte_request_average": pod_allocation.get("ram_byte_request_average", 0.0),
                                                            "ram_cost": pod_allocation.get("ram_cost", 0.0),
                                                            "gpu_cost": pod_allocation.get("gpu_cost", 0.0),
                                                            "gpu_cost_idle": pod_allocation.get("gpu_cost_idle", 0.0),
                                                            "gpu_request_average": pod_allocation.get("gpu_request_average", 0.0),
                                                            "gpu_usage_average": pod_allocation.get("gpu_usage_average", 0.0),
                                                            "pv_cost": pod_allocation.get("pv_cost", 0.0),
                                                            "pv_bytes": pod_allocation.get("pv_bytes"),
                                                            "cpu_cost_idle": pod_allocation.get("cpu_cost_idle", 0.0),
                                                            "ram_cost_idle": pod_allocation.get("ram_cost_idle", 0.0),
                                                            "external_cost": pod_allocation.get("external_cost", 0.0),
                                                            "load_balancer_cost": pod_allocation.get("load_balancer_cost", 0.0),
                                                            "network_cost": pod_allocation.get("network_cost", 0.0),
                                                            "total_cost": pod_allocation.get("total_cost", 0.0),
                                                            "shared_cost": pod_allocation.get("shared_cost", 0.0),
                                                            "ram_usage_gb": pod_allocation.get("ram_usage_gb", 0.0),
                                                            "ram_request_gb": pod_allocation.get("ram_request_gb", 0.0),
                                                            "cpu_efficiency": pod_allocation.get("cpu_efficiency", 0.0),
                                                            "ram_efficiency": pod_allocation.get("ram_efficiency", 0.0),
                                                            "total_efficiency": pod_allocation.get("total_efficiency", 0.0),
                                                            "is_idle": pod_allocation.get("is_idle", False),
                                                            "domain": pod_allocation.get("domain"),
                                                            # "raw_allocation_data": pod_allocation  # Store the full pod data
                                                        }
                                                        
                                                        pod_obj = PodMetrics(**pod_entry)
                                                        session.add(pod_obj)
                                                        results["pod_metrics"] += 1
                                                        
                                                    except Exception as e:
                                                        results["errors"].append(f"PodMetrics {pod_key}: {str(e)}")
                                                        
                                    except Exception as e:
                                        results["errors"].append(f"NodeMetrics {node_key}: {str(e)}")
                        
                except Exception as e:
                    results["errors"].append(f"ClusterMetrics {allocation_key}: {str(e)}")
        
        session.commit()
        return jsonify({"message": "Metrics ingested successfully", **results}), 201
        
    except Exception as e:
        session.rollback()
        return jsonify({"error": f"Failed to process metrics: {str(e)}"}, **results), 500
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
