#!/usr/bin/env python3
"""
scheduler.py — Kubecost Data Collector Scheduler with Dynamic Time Windows

Requirements:
  pip install apscheduler requests python-dotenv

Env Vars:
  BACKEND_API_URL=http://localhost:5000
  COLLECTION_INTERVAL_MIN=60        # how often scheduler checks for missing data (minutes)
  COLLECTION_WINDOW_HOURS=24        # data collection window size (hours)
  REQUEST_TIMEOUT_SEC=30
  RETRY_ATTEMPTS=3
  RETRY_DELAY_SEC=15
  LOG_LEVEL=INFO
  MAX_BACKFILL_WINDOWS=7           # max number of 24h windows to backfill in one run
"""

import os
import sys
import time
import signal
import logging
import base64
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

import requests

requests.packages.urllib3.disable_warnings()
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore

# -------------------- Config --------------------
from dotenv import load_dotenv

load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
COLLECTION_INTERVAL_MIN = int(os.getenv("COLLECTION_INTERVAL_MIN", "60"))
COLLECTION_WINDOW_HOURS = float(os.getenv("COLLECTION_WINDOW_HOURS", "24"))
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_BACKFILL_WINDOWS = int(os.getenv("MAX_BACKFILL_WINDOWS", "7"))

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
        "timestamp": datetime.utcnow().isoformat() + "Z",
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


# -------------------- Time Window Management --------------------
def get_latest_timestamp(cluster_id: int) -> Optional[datetime]:
    """
    Get the latest timestamp for a specific cluster from the backend API.
    Returns None if no data exists (first run scenario).
    """
    url = f"{BACKEND_API_URL}/v1/latest-timestamp"
    try:
        params = {"cluster_id": cluster_id}
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()
        print(data, "----------data")
        # Handle different possible response formats
        if data.get("latest_timestamp"):
            timestamp_str = data["latest_timestamp"]
            # Parse ISO format timestamp
            return datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        else:
            log.info(
                "r cluster_id=%d, will start from 24h ago",
                cluster_id,
            )
            return None
    except Exception as e:
        log.warning(
            "Failed to get latest timestamp for cluster_id=%d: %s", cluster_id, e
        )
        return None


def calculate_next_window(cluster_id: int) -> tuple[datetime, datetime]:
    """
    Calculate the next time window to collect data for.
    Returns (start_time, end_time) tuple.
    """
    latest_timestamp = get_latest_timestamp(cluster_id)

    if latest_timestamp is None:
        # First run - start from 24h ago
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)
    else:
        # Next window starts where the last one ended
        start_time = latest_timestamp
        end_time = start_time + timedelta(hours=COLLECTION_WINDOW_HOURS)

    # Ensure we don't try to collect future data
    now = datetime.utcnow()
    if end_time > now:
        end_time = now
        start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)

    return start_time, end_time


def get_missing_windows(cluster_id: int) -> List[tuple[datetime, datetime]]:
    """
    Get all missing time windows that need to be backfilled.
    Returns a list of (start_time, end_time) tuples.
    """
    windows = []
    latest_timestamp = get_latest_timestamp(cluster_id)
    print(latest_timestamp)
    now = datetime.utcnow()

    if latest_timestamp is None:
        # First run - collect last 24h
        end_time = now
        start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)
        windows.append((start_time, end_time))
        return windows

    # Calculate how many windows we're missing
    time_gap = now - latest_timestamp
    missing_hours = time_gap.total_seconds() / 3600
    missing_windows = int(missing_hours / COLLECTION_WINDOW_HOURS)

    # Limit backfill to prevent overwhelming the system
    missing_windows = min(missing_windows, MAX_BACKFILL_WINDOWS)

    # Generate windows to backfill
    current_start = latest_timestamp
    for _ in range(missing_windows):
        current_end = current_start + timedelta(hours=COLLECTION_WINDOW_HOURS)
        if current_end > now:
            current_end = now

        if current_start < current_end:  # Only add valid windows
            windows.append((current_start, current_end))

        current_start = current_end

    return windows


# -------------------- Helpers --------------------
def get_active_clusters() -> List[Dict]:
    """
    Pull active cluster configs from App 1.
    """
    url = f"{BACKEND_API_URL}/api/internal/cluster-configs"
    try:
        # For now, using hardcoded data as in original
        resp = [
            {
                "cluster_id": 2,
                "user_id": 1,
                "cluster_name": "cluster-two",
                # "kubecost_api_url": "http://172.16.20.110/kubecost",
                "kubecost_api_url": "https://34.100.251.207",
                "password": "Admin@12#$",
                "username": "admin",
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


def fetchPodData(
    kubecost_url: str,
    cluster: str,
    node: str,
    start_time: datetime,
    end_time: datetime,
    headers: Any,
) -> Dict:
    """
    Fetch pod data for a specific cluster and node within a time window.
    """
    # Convert to Kubecost time format
    window_param = format_kubecost_window(start_time, end_time)

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
        "window": window_param,
    }

    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=podParams,
            timeout=REQUEST_TIMEOUT_SEC,
            headers=headers,
            verify=False,
        )
        r.raise_for_status()
        pod_data = r.json()
        return pod_data
    except Exception as e:
        raise RuntimeError(f"Kubecost pod fetch failed: {e}")


def fetchNodeData(
    kubecost_url: str,
    cluster: str,
    start_time: datetime,
    end_time: datetime,
    headers: Any,
) -> Dict:
    """
    Fetch node data for a specific cluster within a time window.
    """
    # Convert to Kubecost time format
    window_param = format_kubecost_window(start_time, end_time)

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
        "window": window_param,
    }

    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=nodeParams,
            timeout=REQUEST_TIMEOUT_SEC,
            headers=headers,
            verify=False,
        )
        r.raise_for_status()
        nodeData = r.json()
        exclude = {"__idle__", "__unallocated__"}

        # Collect pod data for each node and append to node data
        for i in nodeData["data"]["sets"]:
            for node_name in i["allocations"]:
                if node_name not in exclude:
                    try:
                        pod_data = fetchPodData(
                            kubecost_url,
                            cluster,
                            node_name,
                            start_time,
                            end_time,
                            headers,
                        )
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


def format_kubecost_window(start_time: datetime, end_time: datetime) -> str:
    """
    Convert datetime objects to Kubecost absolute window format:
    <start_iso>Z,<end_iso>Z
    """
    return f"{start_time.strftime('%Y-%m-%dT%H:%M:%SZ')},{end_time.strftime('%Y-%m-%dT%H:%M:%SZ')}"


def fetch_kubecost_window(
    kubecost_url: str,
    start_time: datetime,
    end_time: datetime,
    username: str = None,
    password: str = None,
) -> Dict:
    """
    Call Kubecost allocation summary for a specific time window.
    Adds Basic Auth header if username and password are provided.
    """
    print("==========================================")
    print(start_time, end_time, "------------------")
    print("==========================================")

    window_param = format_kubecost_window(start_time, end_time)

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

    log.info(
        "Fetching kubecost data | window=%s start=%s end=%s",
        window_param,
        start_time.isoformat(),
        end_time.isoformat(),
    )

    headers = {}
    if username and password:
        auth_string = f"{username}:{password}"
        encoded_auth = base64.b64encode(auth_string.encode()).decode()
        headers["Authorization"] = f"Basic {encoded_auth}"

    try:
        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=params,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            verify=False,
        )
        r.raise_for_status()
        cluster_data = r.json()
        print(
            "===========================after cluster data===============", cluster_data
        )
        # Fetch node and pod data for each cluster and append to cluster data
        for i in cluster_data.get("data", {}).get("sets", []):
            for cluster_name in i.get("allocations", {}):
                print(
                    "{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}",
                    cluster_name,
                )
                if cluster_name != "__idle__":
                    try:
                        print("========================inside the nodeo data fprmat")
                        node_data = fetchNodeData(
                            kubecost_url,
                            cluster_name,
                            start_time,
                            end_time,
                            headers=headers,
                        )
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
    user_id: int,
    cluster_id: int,
    kubecost_data: Dict,
    window_start: datetime,
    window_end: datetime,
) -> None:
    """
    Format and POST snapshots to App 1 ingestion endpoint with window metadata.
    """
    url = f"{BACKEND_API_URL}/v1/fetchMetrics"

    # Format the data according to schema
    formatted_payload = format_kubecost_response(kubecost_data, user_id, cluster_id)

    # Add window metadata to payload
    formatted_payload["window_metadata"] = {
        "start_time": window_start.isoformat() + "Z",
        "end_time": window_end.isoformat() + "Z",
        "window_hours": COLLECTION_WINDOW_HOURS,
        "collection_timestamp": datetime.utcnow().isoformat() + "Z",
    }

    log.info("Sending to backend | payload_size=%d bytes", len(str(formatted_payload)))

    try:
        r = requests.post(url, json=formatted_payload, timeout=REQUEST_TIMEOUT_SEC)
        r.raise_for_status()
        log.info(
            "Successfully sent data to backend | cluster_id=%d window=%s-%s",
            cluster_id,
            window_start.isoformat(),
            window_end.isoformat(),
        )
    except Exception as e:
        raise RuntimeError(f"Backend API failed: {e}")


def collect_window(cluster_cfg: Dict, start_time: datetime, end_time: datetime) -> bool:
    """
    Collect data for a specific time window with retry logic.
    Returns True if successful, False if all retries failed.
    """
    user_id = cluster_cfg["user_id"]
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    kubecost_url = cluster_cfg["kubecost_api_url"]
    username = cluster_cfg.get("username", "")
    password = cluster_cfg.get("password", "")
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            log.info(
                "Collecting window | cluster=%s attempt=%d/%d start=%s end=%s",
                cluster_name,
                attempt,
                RETRY_ATTEMPTS,
                start_time.strftime("%Y-%m-%d %H:%M:%S"),
                end_time.strftime("%Y-%m-%d %H:%M:%S"),
            )

            # Fetch data from Kubecost
            data = fetch_kubecost_window(
                kubecost_url, start_time, end_time, username, password
            )

            if not data.get("data", {}).get("sets", []):
                log.warning(
                    "No allocation sets returned | cluster=%s window=%s-%s",
                    cluster_name,
                    start_time.isoformat(),
                    end_time.isoformat(),
                )
                return True  # Consider empty data as success to avoid infinite retries

            # Send to backend
            send_snapshots_to_backend(user_id, cluster_id, data, start_time, end_time)
            log.info(
                "Window collection success | cluster=%s window=%s-%s",
                cluster_name,
                start_time.strftime("%Y-%m-%d %H:%M:%S"),
                end_time.strftime("%Y-%m-%d %H:%M:%S"),
            )
            return True

        except Exception as e:
            log.warning(
                "Window collection failed (attempt %d/%d) | cluster=%s | window=%s-%s | err=%s",
                attempt,
                RETRY_ATTEMPTS,
                cluster_name,
                start_time.strftime("%Y-%m-%d %H:%M:%S"),
                end_time.strftime("%Y-%m-%d %H:%M:%S"),
                e,
            )
            if attempt < RETRY_ATTEMPTS:
                time.sleep(RETRY_DELAY_SEC)
            else:
                log.error(
                    "Window collection permanently failed | cluster=%s window=%s-%s",
                    cluster_name,
                    start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    end_time.strftime("%Y-%m-%d %H:%M:%S"),
                )
                return False


def collect_cluster_data(cluster_cfg: Dict) -> None:
    """
    Smart collection for a single cluster - handles backfilling and current data.
    """
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")

    try:
        # Get all missing windows that need to be collected
        missing_windows = get_missing_windows(cluster_id)
        print(missing_windows, "------------missing windows")

        if not missing_windows:
            log.info("No missing windows | cluster=%s", cluster_name)
            return

        log.info(
            "Found %d missing windows to collect | cluster=%s",
            len(missing_windows),
            cluster_name,
        )

        # Collect each missing window
        success_count = 0
        for start_time, end_time in missing_windows:
            if collect_window(cluster_cfg, start_time, end_time):
                success_count += 1
            else:
                # Stop on first failure to maintain data continuity
                log.error(
                    "Stopping collection due to failed window | cluster=%s",
                    cluster_name,
                )
                break

        log.info(
            "Collected %d/%d windows | cluster=%s",
            success_count,
            len(missing_windows),
            cluster_name,
        )

    except Exception as e:
        log.error("Cluster collection failed | cluster=%s err=%s", cluster_name, e)


# -------------------- Scheduler Management --------------------
JOB_PREFIX = "cluster-"


def schedule_cluster_jobs(scheduler: BackgroundScheduler, clusters: List[Dict]):
    """
    Schedule one interval job per active cluster for smart data collection.
    """
    for cfg in clusters:
        job_id = f"{JOB_PREFIX}{cfg['cluster_id']}"
        scheduler.add_job(
            func=collect_cluster_data,
            id=job_id,
            args=[cfg],
            trigger="interval",
            minutes=COLLECTION_INTERVAL_MIN,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=COLLECTION_INTERVAL_MIN * 60 // 2,
            replace_existing=True,
        )
        log.info(
            "Scheduled smart collection job | %s every %d min",
            job_id,
            COLLECTION_INTERVAL_MIN,
        )


def initial_collect_all(scheduler: BackgroundScheduler):
    """
    Run an initial collection on startup for all clusters to catch up on any missing data.
    """
    clusters = get_active_clusters()
    log.info("Starting initial collection for %d clusters", len(clusters))

    for cfg in clusters:
        try:
            collect_cluster_data(cfg)
        except Exception as e:
            log.error(
                "Initial collect failed | cluster_id=%s err=%s",
                cfg.get("cluster_id"),
                e,
            )

    # Schedule ongoing jobs
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
        "Smart scheduler started | Backend=%s interval=%d min window=%d hours max_backfill=%d",
        BACKEND_API_URL,
        COLLECTION_INTERVAL_MIN,
        COLLECTION_WINDOW_HOURS,
        MAX_BACKFILL_WINDOWS,
    )

    # keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown("KeyboardInterrupt", None)


if __name__ == "__main__":
    main()
