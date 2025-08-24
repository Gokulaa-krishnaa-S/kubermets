#!/usr/bin/env python3
"""
scheduler.py — Kubecost Data Collector Scheduler with Schema Formatting

Requirements:
  pip install apscheduler requests python-dotenv

Env Vars:
  BACKEND_API_URL=http://localhost:5000
  COLLECTION_INTERVAL_MIN=60        # how often each cluster runs (minutes)
  COLLECTION_WINDOW_MIN=60          # lookback window for kubecost (minutes)
  REQUEST_TIMEOUT_SEC=30
  RETRY_ATTEMPTS=3
  RETRY_DELAY_SEC=15
  LOG_LEVEL=INFO
"""

import os
import sys
import time
import signal
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore

# -------------------- Config --------------------
from dotenv import load_dotenv

load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
COLLECTION_INTERVAL_MIN = int(os.getenv("COLLECTION_INTERVAL_MIN", "60"))
COLLECTION_WINDOW_MIN = int(os.getenv("COLLECTION_WINDOW_MIN", "60"))
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# -------------------- Logging --------------------
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("kubecost-scheduler")


# -------------------- Schema Formatters --------------------
def bytes_to_gb(bytes_value: Optional[float]) -> Optional[float]:
    """Convert bytes to GB"""
    if bytes_value is None or bytes_value == 0:
        return 0.0
    return bytes_value / (1024**3)


def calculate_percentage(
    usage: Optional[float], request: Optional[float]
) -> Optional[float]:
    """Calculate usage percentage"""
    if not usage or not request or request == 0:
        return 0.0
    return (usage / request) * 100


def calculate_window_duration(start: str, end: str) -> str:
    """Calculate window duration from start and end times"""
    try:
        start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))
        duration = end_dt - start_dt

        hours = duration.total_seconds() / 3600
        if hours >= 168:  # 7 days
            return "7d"
        elif hours >= 24:
            return f"{int(hours // 24)}d"
        elif hours >= 1:
            return f"{int(hours)}h"
        else:
            return f"{int(duration.total_seconds() // 60)}m"
    except:
        return "24h"  # default


def classify_efficiency(efficiency: Optional[float]) -> str:
    """Classify efficiency into categories"""
    if efficiency is None or efficiency == 0:
        return "Low"
    elif efficiency >= 0.8:
        return "High"
    elif efficiency >= 0.5:
        return "Medium"
    else:
        return "Low"


def extract_namespace_and_name(
    allocation_key: str,
) -> tuple[Optional[str], Optional[str]]:
    """Extract namespace and name from allocation key"""
    # Handle different pod naming patterns
    if allocation_key in ["__idle__", "__unallocated__"]:
        return None, allocation_key

    # Try to extract namespace from pod name pattern
    # Common patterns: namespace/podname, podname-hash-hash
    parts = allocation_key.split("/")
    if len(parts) == 2:
        return parts[0], parts[1]

    # If no namespace separator, try to extract from pod name
    if "-" in allocation_key:
        # Could be podname-deployment-hash pattern
        parts = allocation_key.split("-")
        if len(parts) >= 2:
            return None, allocation_key  # Return full name, no namespace

    return None, allocation_key


def format_cluster_metrics(allocation_data: Dict, cluster_name: str = None) -> Dict:
    """Format allocation data to match ClusterMetrics schema"""

    start_time = allocation_data.get("start", "")
    end_time = allocation_data.get("end", "")

    # Calculate derived fields
    cpu_usage_percent = calculate_percentage(
        allocation_data.get("cpuCoreUsageAverage", 0),
        allocation_data.get("cpuCoreRequestAverage", 0),
    )

    memory_usage_percent = calculate_percentage(
        allocation_data.get("ramByteUsageAverage", 0),
        allocation_data.get("ramByteRequestAverage", 0),
    )

    efficiency = allocation_data.get("totalEfficiency", 0)

    formatted_data = {
        # Identification
        "cluster_name": cluster_name or "unknown",
        # Time window information
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "window_start": start_time,
        "window_end": end_time,
        "window_duration": calculate_window_duration(start_time, end_time),
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
        "cpu_core_request_average": allocation_data.get("cpuCoreRequestAverage", 0.0),
        "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
        # Memory metrics
        "ram_byte_request_average": allocation_data.get("ramByteRequestAverage", 0.0),
        "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
        # GPU metrics
        "gpu_request_average": allocation_data.get("gpuRequestAverage", 0.0),
        "gpu_usage_average": allocation_data.get("gpuUsageAverage", 0.0),
        # Efficiency metrics
        "total_efficiency": efficiency,
        # Computed fields
        "cpu_usage_percent": cpu_usage_percent,
        "memory_usage_percent": memory_usage_percent,
        "memory_gb_used": bytes_to_gb(allocation_data.get("ramByteUsageAverage", 0)),
        "memory_gb_requested": bytes_to_gb(
            allocation_data.get("ramByteRequestAverage", 0)
        ),
        "efficiency_percent": efficiency * 100 if efficiency else 0.0,
        # Fields requiring external data (set to null/defaults)
        "cluster_status": None,  # Requires cluster status API
        "cluster_version": None,  # Requires cluster info API
        "node_count": None,  # Requires counting nodes or separate API
        "pod_count": None,  # Requires counting pods or separate API
        "efficiency_category": classify_efficiency(efficiency),
        # API response metadata
        "is_idle_allocation": allocation_data.get("name", "").startswith("__idle__"),
        # Record metadata
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        # "raw_api_response": allocation_data,
        "query_params": None,  # Could store query params used
        "fetch_timestamp": datetime.utcnow().isoformat() + "Z",
    }
    # print(formatted_data , "-----DATA")
    return formatted_data


def format_node_metrics(
    allocation_data: Dict, node_name: str, cluster_name: str = None
) -> Dict:
    """Format node allocation data to match NodeMetrics schema"""

    start_time = allocation_data.get("start", "")
    end_time = allocation_data.get("end", "")
    efficiency = allocation_data.get("totalEfficiency", 0)

    formatted_data = {
        # Node identification
        "node_name": node_name,
        "cluster_name": cluster_name or "unknown",
        # Time window
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "window_start": start_time,
        "window_end": end_time,
        "window_duration": calculate_window_duration(start_time, end_time),
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
        "cpu_core_request_average": allocation_data.get("cpuCoreRequestAverage", 0.0),
        "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
        # Memory metrics
        "ram_byte_request_average": allocation_data.get("ramByteRequestAverage", 0.0),
        "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
        # GPU metrics
        "gpu_request_average": allocation_data.get("gpuRequestAverage", 0.0),
        "gpu_usage_average": allocation_data.get("gpuUsageAverage", 0.0),
        # Efficiency
        "total_efficiency": efficiency,
        # Computed fields
        "cpu_usage_percent": calculate_percentage(
            allocation_data.get("cpuCoreUsageAverage", 0),
            allocation_data.get("cpuCoreRequestAverage", 0),
        ),
        "memory_usage_percent": calculate_percentage(
            allocation_data.get("ramByteUsageAverage", 0),
            allocation_data.get("ramByteRequestAverage", 0),
        ),
        "memory_gb_used": bytes_to_gb(allocation_data.get("ramByteUsageAverage", 0)),
        "memory_gb_requested": bytes_to_gb(
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
        "first_seen": datetime.utcnow().isoformat() + "Z",
        "last_seen": datetime.utcnow().isoformat() + "Z",
        "is_active": True,
        # Metadata
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }

    return formatted_data


def format_pod_metrics(
    allocation_data: Dict, pod_key: str, cluster_name: str = None
) -> Dict:
    """Format pod allocation data to match PodMetrics schema"""

    start_time = allocation_data.get("start", "")
    end_time = allocation_data.get("end", "")
    namespace, name = extract_namespace_and_name(pod_key)

    # Calculate efficiency metrics
    cpu_efficiency = (
        calculate_percentage(
            allocation_data.get("cpuCoreUsageAverage", 0),
            allocation_data.get("cpuCoreRequestAverage", 0),
        )
        / 100
        if allocation_data.get("cpuCoreRequestAverage", 0) > 0
        else 0.0
    )

    ram_efficiency = (
        calculate_percentage(
            allocation_data.get("ramByteUsageAverage", 0),
            allocation_data.get("ramByteRequestAverage", 0),
        )
        / 100
        if allocation_data.get("ramByteRequestAverage", 0) > 0
        else 0.0
    )

    formatted_data = {
        # Identification
        "key": pod_key,
        "namespace": namespace,
        "name": name,
        # Time window
        "start_time": start_time,
        "end_time": end_time,
        "window": calculate_window_duration(start_time, end_time),
        # CPU metrics
        "cpu_core_usage_average": allocation_data.get("cpuCoreUsageAverage", 0.0),
        "cpu_core_request_average": allocation_data.get("cpuCoreRequestAverage", 0.0),
        "cpu_cost": allocation_data.get("cpuCost", 0.0),
        # Memory metrics
        "ram_byte_usage_average": allocation_data.get("ramByteUsageAverage", 0.0),
        "ram_byte_request_average": allocation_data.get("ramByteRequestAverage", 0.0),
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
        "ram_usage_gb": bytes_to_gb(allocation_data.get("ramByteUsageAverage", 0)),
        "ram_request_gb": bytes_to_gb(allocation_data.get("ramByteRequestAverage", 0)),
        "cpu_efficiency": cpu_efficiency,
        "ram_efficiency": ram_efficiency,
        "total_efficiency": allocation_data.get("totalEfficiency", 0.0),
        # Flags
        "is_idle": pod_key.startswith("__idle__"),
        # Query context
        "domain": None,  # Requires business logic
        # Metadata
        "created_at": datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        # "raw_allocation_data": allocation_data
    }

    return formatted_data


def format_kubecost_response(
    kubecost_data: Dict, user_id: int, cluster_id: int
) -> Dict:
    """Format the complete kubecost response according to schema structure"""

    formatted_snapshots = []

    for snapshot_set in kubecost_data.get("data", {}).get("sets", []):
        formatted_allocations = {}

        for allocation_name, allocation_data in snapshot_set.get(
            "allocations", {}
        ).items():

            # Format cluster-level data
            if allocation_name != "__idle__":
                formatted_allocations[allocation_name] = {
                    **format_cluster_metrics(allocation_data, allocation_name),
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
                                **format_node_metrics(
                                    node_allocation, node_name, allocation_name
                                ),
                                "pod_data": None,
                            }

                            # Process pod data if available
                            pod_data = node_allocation.get("pod_data")
                            if pod_data and isinstance(pod_data, dict):
                                formatted_pod_sets = []

                                for pod_set in pod_data.get("data", {}).get("sets", []):
                                    formatted_pod_allocations = {}

                                    for pod_key, pod_allocation in pod_set.get(
                                        "allocations", {}
                                    ).items():
                                        formatted_pod_allocations[pod_key] = (
                                            format_pod_metrics(
                                                pod_allocation, pod_key, allocation_name
                                            )
                                        )

                                    formatted_pod_sets.append(
                                        {
                                            "allocations": formatted_pod_allocations,
                                            "window": pod_set.get("window", {}),
                                        }
                                    )

                                formatted_node_allocations[node_name]["pod_data"] = {
                                    "code": pod_data.get("code", 200),
                                    "data": {
                                        "step": pod_data.get("data", {}).get("step"),
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
                formatted_allocations[allocation_name] = format_cluster_metrics(
                    allocation_data, allocation_name
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
        "snapshots": formatted_snapshots,
    }


# -------------------- Helpers --------------------
def get_active_clusters() -> List[Dict]:
    """
    Pull active cluster configs from App 1.
    Endpoint should return a list like:
    [
      {
        "cluster_id": 1,
        "user_id": 1,
        "cluster_name": "cluster-one",
        "kubecost_api_url": "http://172.16.20.110/kubecost",
        "username": "john"
      },
      ...
    ]
    """
    url = f"{BACKEND_API_URL}/api/internal/cluster-configs"
    try:
        # resp = requests.get(url, timeout=REQUEST_TIMEOUT_SEC)
        # resp.raise_for_status()
        resp = [
            {
                "cluster_id": 1,
                "user_id": 1,
                "cluster_name": "cluster-one",
                "kubecost_api_url": "http://172.16.20.110/kubecost",
                "username": "john",
            }
        ]
        data = resp
        if not isinstance(data, list):
            log.warning("Unexpected configs payload: %s", data)
            return []
        return data
    except Exception as e:
        log.error("Failed to fetch cluster configs: %s", e)
        return []


def fetchPodData(kubecost_url: str, cluster: str, node: str) -> Dict:
    """
    Fetch pod data for a specific cluster and node.
    """
    podParams = {
        "accumulate": "true",
        "aggregate": "pod",
        "chartType": "costovertime",
        "costUnit": "cumulative",
        "external": "false",
        "filter": f'(cluster:"{cluster}")+(node:"{node}")',
        "idle": "true",
        "idleByNode": "false",
        "includeSharedCostBreakdown": "true",
        "shareCost": "0",
        "shareIdle": "false",
        "shareLabels": "",
        "shareNamespaces": "",
        "shareSplit": "weighted",
        "shareTenancyCosts": "true",
        "window": "24h",
    }

    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=podParams,
            timeout=REQUEST_TIMEOUT_SEC,
        )
        r.raise_for_status()
        pod_data = r.json()
        return pod_data
    except Exception as e:
        raise RuntimeError(f"Kubecost pod fetch failed: {e}")


def fetchNodeData(kubecost_url: str, cluster: str) -> Dict:
    """
    Fetch node data for a specific cluster and return node data with pod data.
    """
    nodeParams = {
        "accumulate": "true",
        "aggregate": "node",
        "chartType": "costovertime",
        "costUnit": "cumulative",
        "external": "false",
        "filter": f'(cluster: "{cluster}")',
        "idle": "true",
        "idleByNode": "false",
        "includeSharedCostBreakdown": "true",
        "shareCost": "0",
        "shareIdle": "false",
        "shareLabels": "",
        "shareNamespaces": "",
        "shareSplit": "weighted",
        "shareTenancyCosts": "true",
        "window": "24h",
    }

    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=nodeParams,
            timeout=REQUEST_TIMEOUT_SEC,
        )
        r.raise_for_status()
        nodeData = r.json()
        exclude = {"__idle__", "__unallocated__"}

        # Collect pod data for each node and append to node data
        for i in nodeData["data"]["sets"]:
            for node_name in i["allocations"]:
                if node_name not in exclude:
                    try:
                        pod_data = fetchPodData(kubecost_url, cluster, node_name)
                        # Append pod data to the node allocation
                        i["allocations"][node_name]["pod_data"] = pod_data
                    except Exception as e:
                        log.error(
                            "Failed to fetch pod data for node %s: %s", node_name, e
                        )
                        i["allocations"][node_name]["pod_data"] = {"error": str(e)}

        return nodeData
    except Exception as e:
        raise RuntimeError(f"Kubecost node fetch failed: {e}")


def fetch_kubecost_window(kubecost_url: str, window_minutes: int) -> Dict:
    """
    Call Kubecost allocation summary for the given time window.
    """
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(minutes=window_minutes)
    window_param = f"24h"

    params = {
        "accumulate": "true",
        "aggregate": "cluster",
        "chartType": "costovertime",
        "costUnit": "cumulative",
        "external": "false",
        "filter": "",
        "idle": "true",
        "idleByNode": "false",
        "includeSharedCostBreakdown": "true",
        "shareCost": "0",
        "shareIdle": "false",
        "shareLabels": "",
        "shareNamespaces": "",
        "shareSplit": "weighted",
        "shareTenancyCosts": "true",
        "window": window_param,
    }

    print("=============================")
    print(params)
    print("=============================")
    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=params,
            timeout=REQUEST_TIMEOUT_SEC,
        )
        r.raise_for_status()
        cluster_data = r.json()
        # Fetch node and pod data for each cluster and append to cluster data
        for i in cluster_data.get("data", {}).get("sets", []):
            for cluster_name in i.get("allocations", {}):
                if cluster_name != "__idle__":
                    try:
                        node_data = fetchNodeData(kubecost_url, cluster_name)
                        # Append node data (which includes pod data) to the cluster allocation
                        i["allocations"][cluster_name]["node_data"] = node_data
                    except Exception as e:
                        log.error(
                            "Failed to fetch node data for cluster %s: %s",
                            cluster_name,
                            e,
                        )
                        i["allocations"][cluster_name]["node_data"] = {"error": str(e)}

        return cluster_data
    except Exception as e:
        raise RuntimeError(f"Kubecost fetch failed: {e}")


def send_snapshots_to_backend(
    user_id: int, cluster_id: int, kubecost_data: Dict
) -> None:
    """
    Format and POST snapshots to App 1 ingestion endpoint.
    """
    url = f"{BACKEND_API_URL}/v1/fetchMetrics"

    # Format the data according to schema
    formatted_payload = format_kubecost_response(kubecost_data, user_id, cluster_id)

    print(
        "====================================FORMATTED PAYLOAD========================================================="
    )
    print(formatted_payload)
    print("=================SENT TO BACKEND")

    # Uncomment when ready to send to backend
    r = requests.post(url, json=formatted_payload, timeout=REQUEST_TIMEOUT_SEC)
    r.raise_for_status()


def collect_once(cluster_cfg: Dict) -> None:
    """
    One collection cycle for a single cluster with basic retry logic.
    """
    user_id = cluster_cfg["user_id"]
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    kubecost_url = cluster_cfg["kubecost_api_url"]

    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            log.info("Collect start | cluster=%s attempt=%d", cluster_name, attempt)
            data = fetch_kubecost_window(kubecost_url, COLLECTION_WINDOW_MIN)

            if not data.get("data", {}).get("sets", []):
                log.warning("No allocation sets returned | cluster=%s", cluster_name)
                return

            send_snapshots_to_backend(user_id, cluster_id, data)
            log.info("Collect success | cluster=%s", cluster_name)
            return

        except Exception as e:
            log.warning(
                "Collect failed (attempt %d/%d) | cluster=%s | err=%s",
                attempt,
                RETRY_ATTEMPTS,
                cluster_name,
                e,
            )
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SEC)
            else:
                log.error("Collect permanently failed | cluster=%s", cluster_name)


# -------------------- Scheduler Management --------------------
JOB_PREFIX = "cluster-"


def schedule_cluster_jobs(scheduler: BackgroundScheduler, clusters: List[Dict]):
    """
    Schedule one interval job per active cluster.
    """
    for cfg in clusters:
        job_id = f"{JOB_PREFIX}{cfg['cluster_id']}"
        scheduler.add_job(
            func=collect_once,
            id=job_id,
            args=[cfg],
            trigger="interval",
            minutes=COLLECTION_INTERVAL_MIN,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=COLLECTION_INTERVAL_MIN * 60 // 2,
            replace_existing=True,
        )
        log.info("Scheduled job | %s every %d min", job_id, COLLECTION_INTERVAL_MIN)


def initial_collect_all(scheduler: BackgroundScheduler):
    """
    Run a collection immediately on startup for all clusters.
    """
    clusters = get_active_clusters()
    for cfg in clusters:
        try:
            collect_once(cfg)
        except Exception as e:
            log.error(
                "Initial collect failed | cluster_id=%s err=%s",
                cfg.get("cluster_id"),
                e,
            )
    # ensure jobs are scheduled
    schedule_cluster_jobs(scheduler, clusters)


# -------------------- Main --------------------
def main():
    jobstores = {"default": MemoryJobStore()}
    executors = {"default": ThreadPoolExecutor(max_workers=10)}
    job_defaults = {"coalesce": True, "max_instances": 1}
    scheduler = BackgroundScheduler(
        jobstores=jobstores, executors=executors, job_defaults=job_defaults
    )
    scheduler.start()

    # graceful shutdown
    def shutdown(signum, frame):
        log.info("Shutting down scheduler (signal=%s)...", signum)
        scheduler.shutdown(wait=True)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # initial bootstrapping
    initial_collect_all(scheduler)

    log.info(
        "Scheduler started. Backend=%s interval=%d min window=%d min",
        BACKEND_API_URL,
        COLLECTION_INTERVAL_MIN,
        COLLECTION_WINDOW_MIN,
    )

    # keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown("KeyboardInterrupt", None)


if __name__ == "__main__":
    main()
