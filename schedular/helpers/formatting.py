from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta, timezone
from helpers.hepler import HelperClass
import os

helper = HelperClass()


class dataFormatter:
    def format_kubecost_window(self, start_time: datetime, end_time: datetime) -> str:
        """
        Convert datetime objects to Kubecost absolute window format:
        <start_iso>Z,<end_iso>Z
        """
        # Ensure both times are timezone-aware
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)

        return f"{start_time.strftime('%Y-%m-%dT%H:%M:%SZ')},{end_time.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    def format_cluster_metrics(
        self, allocation_data: Dict, cluster_name: str = None
    ) -> Dict:
        """Format allocation data to match ClusterMetrics schema"""
        start_time = allocation_data.get("start", "")
        end_time = allocation_data.get("end", "")

        # Calculate derived fields
        cpu_usage_percent = helper.calculate_percentage(
            allocation_data.get("cpuCoreUsageAverage", 0),
            allocation_data.get("cpuCoreRequestAverage", 0),
        )
        memory_usage_percent = helper.calculate_percentage(
            allocation_data.get("ramByteUsageAverage", 0),
            allocation_data.get("ramByteRequestAverage", 0),
        )
        efficiency = allocation_data.get("totalEfficiency", 0)
        formatted_data = {
            # Identification
            "cluster_name": (os.getenv("CLUSTER_NAME", "cluster_one")),
            # Time window information
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "window_start": start_time,
            "window_end": end_time,
            "window_duration": helper.calculate_window_duration(start_time, end_time),
            # Cost metrics (directly from API)
            "total_cost": allocation_data.get("totalCost", 0.0),
            "cpu_cost": allocation_data.get("cpuCost", 0.0),
            "cpu_cost_idle": allocation_data.get("cpuCostIdle", 0.0),
            "ram_cost": allocation_data.get("ramCost", 0.0),
            "ram_cost_idle": allocation_data.get("ramCostIdle", 0.0),
            "pv_cost": allocation_data.get("pvCost", 0.0),
            "network_cost": allocation_data.get("networkCost", 0.0),
            "gpu_cost": allocation_data.get("gpuCost", 0.0),
            "gpu_cost_idle": allocation_data.get("gpuCostIdle", 0.0),
            "load_balancer_cost": allocation_data.get("loadBalancerCost", 0.0),
            "external_cost": allocation_data.get("externalCost", 0.0),
            "shared_cost": allocation_data.get("sharedCost", 0.0),
            # CPU metrics
            "cpu_core_request_average": allocation_data.get(
                "cpuCoreRequestAverage", 0.0
            ),
            "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
            # Memory metrics
            "ram_byte_request_average": allocation_data.get(
                "ramByteRequestAverage", 0.0
            ),
            "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
            # GPU metrics
            "gpu_request_average": allocation_data.get("gpuRequestAverage", 0.0),
            "gpu_usage_average": allocation_data.get("gpuUsageAverage", 0.0),
            # Efficiency metrics
            "total_efficiency": efficiency,
            # Computed fields
            "cpu_usage_percent": cpu_usage_percent,
            "memory_usage_percent": memory_usage_percent,
            "memory_gb_used": helper.bytes_to_gb(
                allocation_data.get("ramByteUsageAverage", 0)
            ),
            "memory_gb_requested": helper.bytes_to_gb(
                allocation_data.get("ramByteRequestAverage", 0)
            ),
            "efficiency_percent": efficiency * 100 if efficiency else 0.0,
            # Fields requiring external data (set to null/defaults)
            "cluster_status": None,  # Requires cluster status API
            "cluster_version": None,  # Requires cluster info API
            "node_count": None,  # Requires counting nodes or separate API
            "pod_count": None,  # Requires counting pods or separate API
            "efficiency_category": helper.classify_efficiency(efficiency),
            # API response metadata
            "is_idle_allocation": allocation_data.get("name", "").startswith(
                "__idle__"
            ),
            # Record metadata
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # "raw_api_response": allocation_data,
            "query_params": None,  # Could store query params used
            "fetch_timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        return formatted_data

    def format_node_metrics(
        self,
        allocation_data: Dict,
        node_name: str,
        cluster_name: str = None,
        node_mapping: Dict = None,
    ) -> Dict:
        """Format node allocation data to match NodeMetrics schema with namespace/deployment info"""

        start_time = allocation_data.get("start", "")
        end_time = allocation_data.get("end", "")
        efficiency = allocation_data.get("totalEfficiency", 0)

        # Get namespace and deployment info from mapping
        mapping_info = node_mapping.get(node_name, {}) if node_mapping else {}
        namespace = mapping_info.get("namespace")
        deployment = mapping_info.get("deployment")

        formatted_data = {
            # Node identification
            "node_name": node_name,
            "cluster_name":  (os.getenv("CLUSTER_NAME", "cluster_one")),
            # Enhanced with namespace and deployment info
            "namespace": namespace,
            "deployment_name": deployment,
            # Time window
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "window_start": start_time,
            "window_end": end_time,
            "window_duration": helper.calculate_window_duration(start_time, end_time),
            # Cost metrics (directly from API)
            "total_cost": allocation_data.get("totalCost", 0.0),
            "cpu_cost": allocation_data.get("cpuCost", 0.0),
            "cpu_cost_idle": allocation_data.get("cpuCostIdle", 0.0),
            "ram_cost": allocation_data.get("ramCost", 0.0),
            "ram_cost_idle": allocation_data.get("ramCostIdle", 0.0),
            "pv_cost": allocation_data.get("pvCost", 0.0),
            "network_cost": allocation_data.get("networkCost", 0.0),
            "gpu_cost": allocation_data.get("gpuCost", 0.0),
            "gpu_cost_idle": allocation_data.get("gpuCostIdle", 0.0),
            "load_balancer_cost": allocation_data.get("loadBalancerCost", 0.0),
            "external_cost": allocation_data.get("externalCost", 0.0),
            "shared_cost": allocation_data.get("sharedCost", 0.0),
            # CPU metrics
            "cpu_core_request_average": allocation_data.get(
                "cpuCoreRequestAverage", 0.0
            ),
            "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
            # Memory metrics
            "ram_byte_request_average": allocation_data.get(
                "ramByteRequestAverage", 0.0
            ),
            "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
            # GPU metrics
            "gpu_request_average": allocation_data.get("gpuRequestAverage", 0.0),
            "gpu_usage_average": allocation_data.get("gpuUsageAverage", 0.0),
            # Efficiency
            "total_efficiency": efficiency,
            # Computed fields
            "cpu_usage_percent": helper.calculate_percentage(
                allocation_data.get("cpuCoreUsageAverage", 0),
                allocation_data.get("cpuCoreRequestAverage", 0),
            ),
            "memory_usage_percent": helper.calculate_percentage(
                allocation_data.get("ramByteUsageAverage", 0),
                allocation_data.get("ramByteRequestAverage", 0),
            ),
            "memory_gb_used": helper.bytes_to_gb(
                allocation_data.get("ramByteUsageAverage", 0)
            ),
            "memory_gb_requested": helper.bytes_to_gb(
                allocation_data.get("ramByteRequestAverage", 0)
            ),
            "efficiency_percent": efficiency * 100 if efficiency else 0.0,
            # Fields requiring external data (set to null/defaults)
            "node_status": None,  # Requires K8s node status API
            "node_health_score": None,  # Requires custom calculation
            "node_instance_type": None,  # Requires K8s node API or cloud metadata
            "node_zone": None,  # Requires K8s node API or cloud metadata
            # Special node types
            "is_idle_allocation": node_name.startswith("__idle__"),
            "is_unallocated": node_name.startswith("__unallocated__"),
            "is_system_allocation": node_name in ["__idle__", "__unallocated__"],
            # Lifecycle (set defaults)
            "first_seen": datetime.now(timezone.utc).isoformat(),
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "is_active": True,
            # Metadata
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        return formatted_data

    def format_pod_metrics(
        self,
        allocation_data: Dict,
        pod_key: str,
        cluster_name: str = None,
        pod_mapping: Dict = None,
    ) -> Dict:
        """Format pod allocation data to match PodMetrics schema with namespace/deployment info"""

        start_time = allocation_data.get("start", "")
        end_time = allocation_data.get("end", "")

        # Get enhanced info from mapping or parse from key
        mapping_info = pod_mapping.get(pod_key, {}) if pod_mapping else {}

        # Try to get from mapping first, then parse from key
        if mapping_info:
            namespace = mapping_info.get("namespace")
            deployment = mapping_info.get("deployment")
            node_name = mapping_info.get("node")
            # Extract just the pod name from the full key
            _, _, pod_name, _, _ = helper.parse_allocation_key(pod_key)
            name = pod_name or pod_key
        else:
            # Fallback to original parsing
            namespace, name = helper.extract_namespace_and_name(pod_key)
            deployment = None
            node_name = None

        cpu_efficiency = (
            helper.calculate_percentage(
                allocation_data.get("cpuCoreUsageAverage", 0),
                allocation_data.get("cpuCoreRequestAverage", 0),
            )
            if allocation_data.get("cpuCoreRequestAverage", 0) > 0
            else 0.0
        )

        ram_efficiency = (
            helper.calculate_percentage(
                allocation_data.get("ramByteUsageAverage", 0),
                allocation_data.get("ramByteRequestAverage", 0),
            )
            if allocation_data.get("ramByteRequestAverage", 0) > 0
            else 0.0
        )

        formatted_data = {
            # Identification
            "key": pod_key,
            "namespace": namespace,
            "name": name,
            # Enhanced with deployment and node info
            "deployment_name": deployment,
            "node_name": node_name,
            # Time window
            "start_time": start_time,
            "end_time": end_time,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "window": helper.calculate_window_duration(start_time, end_time),
            # CPU metrics
            "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
            "cpu_core_request_average": allocation_data.get(
                "cpuCoreRequestAverage", 0.0
            ),
            "cpu_cost": allocation_data.get("cpuCost", 0.0),
            # Memory metrics
            "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
            "ram_byte_request_average": allocation_data.get(
                "ramByteRequestAverage", 0.0
            ),
            "ram_cost": allocation_data.get("ramCost", 0.0),
            # GPU metrics
            "gpu_cost": allocation_data.get("gpuCost", 0.0),
            "gpu_cost_idle": allocation_data.get("gpuCostIdle", 0.0),
            "gpu_request_average": allocation_data.get("gpuRequestAverage", 0.0),
            "gpu_usage_average": allocation_data.get("gpuUsageAverage", 0.0),
            # Storage
            "pv_cost": allocation_data.get("pvCost", 0.0),
            "pv_bytes": None,  # Requires PV API
            # Additional costs
            "cpu_cost_idle": allocation_data.get("cpuCostIdle", 0.0),
            "ram_cost_idle": allocation_data.get("ramCostIdle", 0.0),
            "external_cost": allocation_data.get("externalCost", 0.0),
            "load_balancer_cost": allocation_data.get("loadBalancerCost", 0.0),
            "network_cost": allocation_data.get("networkCost", 0.0),
            # Cost breakdown
            "total_cost": allocation_data.get("totalCost", 0.0),
            "shared_cost": allocation_data.get("sharedCost", 0.0),
            # Derived fields
            "ram_usage_gb": helper.bytes_to_gb(
                allocation_data.get("ramByteUsageAverage", 0)
            ),
            "ram_request_gb": helper.bytes_to_gb(
                allocation_data.get("ramByteRequestAverage", 0)
            ),
            "cpu_efficiency": cpu_efficiency,
            "ram_efficiency": ram_efficiency,
            "total_efficiency": allocation_data.get("totalEfficiency", 0.0),
            # Flags
            "is_idle": pod_key.startswith("__idle__"),
            # Query context
            "domain": None,  # Requires business logic
            # Metadata
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            # "raw_allocation_data": allocation_data
        }

        return formatted_data

    def format_kubecost_response(
        self,
        kubecost_data: Dict,
        user_id: int,
        cluster_id: int,
        node_mapping: Dict = None,
        pod_mapping: Dict = None,
        clear: bool = False,
        window_start:datetime = None,
        window_end: datetime = None  
    ) -> Dict:
        """Format the complete kubecost response according to schema structure with enhanced mapping"""

        formatted_snapshots = []

        for snapshot_set in kubecost_data.get("data", {}).get("sets", []):
            formatted_allocations = {}
            

            for allocation_name, allocation_data in snapshot_set.get(
                "allocations", {}
            ).items():

                # Format cluster-level data
                if allocation_name != "__idle__":
                    formatted_allocations[allocation_name] = {
                        **dataFormatter.format_cluster_metrics(
                            self,allocation_data, allocation_name
                        ),
                        "node_data": None,
                    }

                    # Process node data if available
                    node_data = allocation_data.get("node_data")
                    if node_data and isinstance(node_data, dict):
                        formatted_node_sets = []

                        for node_set in node_data.get("data", {}).get("sets", []):
                            formatted_node_allocations = {}

                            for node_name, node_allocation in node_set.get(
                                "allocations", {}
                            ).items():
                                formatted_node_allocations[node_name] = {
                                    **dataFormatter.format_node_metrics(
                                        self,
                                        node_allocation,
                                        node_name,
                                        allocation_name,
                                        node_mapping,
                                    ),
                                    "pod_data": None,
                                }

                                # Process pod data if available
                                pod_data = node_allocation.get("pod_data")
                                if pod_data and isinstance(pod_data, dict):
                                    formatted_pod_sets = []

                                    for pod_set in pod_data.get("data", {}).get(
                                        "sets", []
                                    ):
                                        formatted_pod_allocations = {}

                                        for pod_key, pod_allocation in pod_set.get(
                                            "allocations", {}
                                        ).items():
                                            formatted_pod_allocations[pod_key] = (
                                                dataFormatter.format_pod_metrics(
                                                    self,
                                                    pod_allocation,
                                                    pod_key,
                                                    allocation_name,
                                                    pod_mapping,
                                                )
                                            )

                                        formatted_pod_sets.append(
                                            {
                                                "allocations": formatted_pod_allocations,
                                                "window": pod_set.get("window", {}),
                                            }
                                        )

                                    formatted_node_allocations[node_name][
                                        "pod_data"
                                    ] = {
                                        "code": pod_data.get("code", 200),
                                        "data": {
                                            "step": pod_data.get("data", {}).get(
                                                "step"
                                            ),
                                            "sets": formatted_pod_sets,
                                            "window": pod_data.get("data", {}).get(
                                                "window", {}
                                            ),
                                        },
                                    }

                            formatted_node_sets.append(
                                {
                                    "allocations": formatted_node_allocations,
                                    "window": node_set.get("window", {}),
                                }
                            )

                        formatted_allocations[allocation_name]["node_data"] = {
                            "code": node_data.get("code", 200),
                            "data": {
                                "step": node_data.get("data", {}).get("step"),
                                "sets": formatted_node_sets,
                                "window": node_data.get("data", {}).get("window", {}),
                            },
                        }

                else:
                    # Handle idle allocations
                    formatted_allocations[allocation_name] = (
                        dataFormatter.format_cluster_metrics(
                           self, allocation_data, allocation_name
                        )
                    )

            formatted_snapshots.append(
                {
                    "allocations": formatted_allocations,
                    "window": snapshot_set.get("window", {}),
                    
                }
            )

        return {
            "user_id": user_id,
            "cluster_id": cluster_id,
            "clear":clear,
            "window_start": window_start.isoformat(),
            "window_end":window_end.isoformat(),
            "snapshots": formatted_snapshots
            
        }
