"""
utils.py - Shared utilities and functions for Kubecost data collection
"""

import os
import sys
import logging
import time
import requests
import base64
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from helpers.formatting import dataFormatter
from helpers.hepler import HelperClass

helper = HelperClass()

formatter = dataFormatter()
# -------------------- Config --------------------
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))

log = logging.getLogger("kubecost-data-revision")

RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
COLLECTION_WINDOW_HOURS = float(os.getenv("COLLECTION_WINDOW_HOURS", "24"))
COLLECTION_WINDOW_HOURS_FOR_BACKFILL= float(os.getenv("COLLECTION_WINDOW_HOURS_FOR_BACKFILL", "24"))
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_BACKFILL_WINDOWS = int(os.getenv("MAX_BACKFILL_WINDOWS", "7"))
MIN_SCHEDULE_INTERVAL_MIN = int(os.getenv("MIN_SCHEDULE_INTERVAL_MIN", "30"))
CLUSTER_ID = int(os.getenv("CLUSTER_ID", "89"))
CLUSTER_NAME =os.getenv("CLUSTER_NAME", "cluster_one")
USER_ID = os.getenv("USER_ID", "ba39e517-8cda-4e30-8cf7-bb159f0d9c98")
USERNAME =os.getenv("USERNAME", "admin")
PASSWORD =os.getenv("PASSWORD", "Admin@12#$")                
KUBECOST_API_URL = (os.getenv("KUBECOST_API_URL", "http://172.16.20.110/kubecost")) 

# Debug environment variables
log.info("Environment Variables:")
log.info(f"BACKEND_API_URL: {BACKEND_API_URL}")
log.info(f"KUBECOST_API_URL: {KUBECOST_API_URL}")
log.info(f"CLUSTER_ID: {CLUSTER_ID}")
log.info(f"CLUSTER_NAME: {CLUSTER_NAME}")
log.info(f"USER_ID: {USER_ID}")
log.info(f"USERNAME: {USERNAME}")


def get_active_clusters() -> List[Dict]:
    """
    Pull active cluster configs from App 1.
    """
    url = f"{BACKEND_API_URL}/api/internal/cluster-configs"
    try:
        # For now, using hardcoded data as in original
        resp = [
            {
                "cluster_id": CLUSTER_ID,
                "user_id": USER_ID,
                "cluster_name": CLUSTER_NAME,
                "kubecost_api_url": KUBECOST_API_URL,
                # "kubecost_api_url": "https://34.100.251.207",
                "password": PASSWORD,
                "username": USERNAME,
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



def fetch_kubecost_window(
    kubecost_url: str,
    start_time: datetime,
    end_time: datetime,
    username: str = None,
    password: str = None,
) -> Tuple[Dict, Dict, Dict]:
    """
    Call Kubecost allocation summary for a specific time window.
    Also fetches multi-aggregation data for namespace/deployment mapping.
    Returns: (cluster_data, node_mapping, pod_mapping)
    """
    window_param = formatter.format_kubecost_window(start_time, end_time)

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

        # Initialize mapping tables
        node_mapping = {}
        pod_mapping = {}

        # Fetch multi-aggregation data for each cluster to build mapping tables
        for i in cluster_data.get("data", {}).get("sets", []):
            for cluster_name in i.get("allocations", {}):
                if cluster_name != "__idle__":
                    try:
                        # Fetch multi-aggregation data for mapping
                        multi_agg_data = fetch_multi_aggregation_data(
                            kubecost_url, cluster_name, start_time, end_time, headers
                        )
                        # Build mapping tables
                        cluster_node_mapping, cluster_pod_mapping = (
                            build_mapping_tables(multi_agg_data)
                        )
                        node_mapping.update(cluster_node_mapping)
                        pod_mapping.update(cluster_pod_mapping)

                        # Fetch node data with enhanced mapping
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
                            "Failed to fetch enhanced data for cluster %s: %s",
                            cluster_name,
                            e,
                        )
                        i["allocations"][cluster_name]["node_data"] = {"error": str(e)}

        return cluster_data, node_mapping, pod_mapping

    except Exception as e:
        raise RuntimeError(f"Kubecost fetch failed: {e}")


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
    window_param = formatter.format_kubecost_window(start_time, end_time)

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
    window_param = formatter.format_kubecost_window(start_time, end_time)

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



def build_mapping_tables(
    multi_agg_data: Dict,
) -> Tuple[Dict[str, Dict], Dict[str, Dict]]:
    """
    Build mapping tables from multi-aggregation data.
    Returns: (node_mapping, pod_mapping)

    node_mapping: {node_name: {namespace: ..., deployment: ...}}
    pod_mapping: {pod_name: {namespace: ..., deployment: ...}}
    """
    node_mapping = {}
    pod_mapping = {}

    try:
        for allocation_set in multi_agg_data.get("data", {}).get("sets", []):
            for allocation_key, allocation_data in allocation_set.get(
                "allocations", {}
            ).items():
                # Skip idle and unallocated
                if allocation_key.startswith("__"):
                    continue

                # Parse the allocation key
                cluster, node, pod, namespace, controller = helper.parse_allocation_key(
                    allocation_key
                )

                if node and node not in node_mapping:
                    node_mapping[node] = {
                        "namespace": namespace,
                        "deployment": controller,
                        "cluster": cluster,
                    }

                if pod and pod not in pod_mapping:
                    pod_mapping[pod] = {
                        "namespace": namespace,
                        "deployment": controller,
                        "cluster": cluster,
                        "node": node,
                    }

    except Exception as e:
        log.exception(
            "Failed to build mapping tables | type=%s | value=%s | err=%s",
            type(multi_agg_data),
            str(multi_agg_data)[:500],  # log first 500 chars only
            e,
        )

    return node_mapping, pod_mapping



def fetch_multi_aggregation_data(
    kubecost_url: str,
    cluster_name: str,
    start_time: datetime,
    end_time: datetime,
    headers: Dict,
) -> Dict:
    """
    Fetch data using multi-aggregation API to get namespace and deployment information.
    This provides the mapping data for enriching our node and pod metrics.
    """
    window_param = formatter.format_kubecost_window(start_time, end_time)

    params = {
        "accumulate": "true",
        "aggregate": "cluster,node,pod,namespace,controller",
        "chartType": "costovertime",
        "costUnit": "cumulative",
        "external": "false",
        "filter": f'(cluster:"{cluster_name}")+controllerKind:"deployment"',
        "idle": "true",
        "idleByNode": "false",
        "includeSharedCostBreakdown": "true",
        "shareCost": "0",
        "shareIdle": "false",
        "shareLabels": "",
        "shareNamespaces": "",
        "shareSplit": "weighted",
        "shareTenancyCosts": "true",
        "sortByOrder": "desc",
        "sortBy": "pvCost",
        "window": window_param,
    }

    try:
        log.info(
            "Fetching multi-aggregation data | cluster=%s window=%s",
            cluster_name,
            window_param,
        )

        r = requests.get(
            f"{kubecost_url}/model/allocation/summary",
            params=params,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SEC,
            verify=False,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.error("Multi-aggregation fetch failed: %s", e)
        return {}


def send_snapshots_to_backend(
    user_id: int,
    cluster_id: int,
    kubecost_data: Dict,
    window_start: datetime,
    window_end: datetime,
    node_mapping: Dict = None,
    pod_mapping: Dict = None,
    clear: bool = False, 
) -> None:
    """
    Format and POST snapshots to App 1 ingestion endpoint with window metadata and enhanced mapping.
    """
    url = f"{BACKEND_API_URL}/v1/fetchMetrics"

    # Format the data according to schema with enhanced mapping

    formatted_payload = formatter.format_kubecost_response(
        kubecost_data, user_id, cluster_id, node_mapping, pod_mapping,clear,window_start,window_end
    )


    # Add window metadata to payload
    formatted_payload["window_metadata"] = {
        "start_time": window_start.isoformat(),
        "end_time": window_end.isoformat(),
        "window_hours": COLLECTION_WINDOW_HOURS,
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Add mapping metadata for debugging
    formatted_payload["mapping_metadata"] = {
        "nodes_mapped": len(node_mapping) if node_mapping else 0,
        "pods_mapped": len(pod_mapping) if pod_mapping else 0,
    }

    log.info(
        "Sending to backend | payload_size=%d bytes | nodes_mapped=%d | pods_mapped=%d",
        len(str(formatted_payload)),
        len(node_mapping) if node_mapping else 0,
        len(pod_mapping) if pod_mapping else 0,
    )

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
    Collect data for a specific time window with retry logic and enhanced mapping.
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

            # Fetch data from Kubecost with enhanced mapping
            data, node_mapping, pod_mapping = fetch_kubecost_window(
                kubecost_url, start_time, end_time, username, password
            )
            if not data.get("data", {}).get("sets", []):
                log.warning(
                    "No allocation sets returned | cluster=%s window=%s-%s",
                    cluster_name,
                    start_time.isoformat(),
                    end_time.isoformat(),
                )
                return True  

            send_snapshots_to_backend(
                user_id,
                cluster_id,
                data,
                start_time,
                end_time,
                node_mapping,
                pod_mapping,
                True
            )
            log.info(
                "Window collection success | cluster=%s window=%s-%s | mapped_nodes=%d | mapped_pods=%d",
                cluster_name,
                start_time.strftime("%Y-%m-%d %H:%M:%S"),
                end_time.strftime("%Y-%m-%d %H:%M:%S"),
                len(node_mapping),
                len(pod_mapping),
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

