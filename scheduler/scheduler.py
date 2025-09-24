#!/usr/bin/env python3
"""
scheduler.py — Kubecost Data Collector Scheduler with Dynamic Time Windows and Namespace/Deployment Mapping

Requirements:
  pip install apscheduler requests python-dotenv

Env Vars:
  BACKEND_API_URL=http://localhost:5000
  COLLECTION_WINDOW_HOURS=24        # data collection window size (hours)
  REQUEST_TIMEOUT_SEC=30
  RETRY_ATTEMPTS=3
  RETRY_DELAY_SEC=15
  LOG_LEVEL=INFO
  MAX_BACKFILL_WINDOWS=7           # max number of 24h windows to backfill in one run
  MIN_SCHEDULE_INTERVAL_MIN=30     # minimum interval between collections (minutes)
"""

import os
import sys
import time
import signal
import logging
import base64
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Tuple
# from pydantic import BaseModel

import requests
# import uvicorn
# from fastapi import FastAPI, HTTPException, BackgroundTasks
# from fastapi.responses import JSONResponse

requests.packages.urllib3.disable_warnings()
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore


# -------------------- Config --------------------
from dotenv import load_dotenv
from helpers.hepler import HelperClass
from helpers.formatting import dataFormatter
from datarevision import run_revision_for_all_clusters


# Import revision scheduler functions conditionally to avoid circular imports
def import_revision_scheduler():
    from datarevision import start_revision_scheduler, shutdown_revision_scheduler
    return start_revision_scheduler, shutdown_revision_scheduler

formatter = dataFormatter()
helper = HelperClass()
load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
COLLECTION_WINDOW_HOURS = float(os.getenv("COLLECTION_WINDOW_HOURS", "24"))
HOURLY_COLLECTION_WINDOW= float(os.getenv("HOURLY_COLLECTION_WINDOW", "1"))
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_BACKFILL_WINDOWS = int(os.getenv("MAX_BACKFILL_WINDOWS", "7"))
MIN_SCHEDULE_INTERVAL_MIN = int(os.getenv("MIN_SCHEDULE_INTERVAL_MIN", "30"))
CLUSTER_ID = int(os.getenv("CLUSTER_ID", "1"))
CLUSTER_NAME = (os.getenv("CLUSTER_NAME", "cluster_one"))
USER_ID = (os.getenv("USER_ID", "1"))
USERNAME = (os.getenv("USERNAME", "admin"))
PASSWORD = (os.getenv("PASSWORD", "Admin@12#$"))                  
KUBECOST_API_URL = (os.getenv("KUBECOST_API_URL", "")) 
MAX_BACKFILL_WINDOWS_END = int(os.getenv("MAX_BACKFILL_WINDOWS_END", "7"))
# API_PORT = int(os.getenv("API_PORT", "8080"))
# API_HOST = os.getenv("API_HOST", "0.0.0.0")                 


# -------------------- Logging --------------------
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("kubecost-scheduler")


# # -------------------- FastAPI Models --------------------
# class TriggerRequest(BaseModel):
#     cluster_id: Optional[int] = None

# class TriggerResponse(BaseModel):
#     status: str
#     message: str
#     clusters: List[Dict]

# class HealthResponse(BaseModel):
#     status: str
#     service: str
#     timestamp: str

# class ClusterStatus(BaseModel):
#     cluster_id: int
#     cluster_name: str
#     status: str
#     error: Optional[str] = None

# # -------------------- FastAPI App --------------------
# app = FastAPI(
#     title="Kubecost Scheduler API",
#     description="API to trigger Kubecost data collection manually",
#     version="1.0.0"
# )


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
        # "filter": f'cluster:"{cluster_name}"',  # Remove deployment restriction to get all resources
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
        log.error("Multi-aggregation fetch failed for cluster %s: %s", cluster_name, e)
        log.debug("Request parameters: %s", params)
        if r := locals().get('r'):
            log.debug("Response status: %s", r.status_code)
            log.debug("Response content: %s", r.text[:500] if hasattr(r, 'text') else 'No response text')
        return {}

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
    
    log.debug("Building mapping tables from data: %s", 
              str(multi_agg_data.get("data", {}))[:500] if multi_agg_data else "No data")

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
                
                log.debug("Parsed allocation: cluster=%s node=%s pod=%s ns=%s controller=%s",
                         cluster, node, pod, namespace, controller)

                if node and node not in node_mapping:
                    node_mapping[node] = {
                        "namespace": namespace,
                        "deployment": controller,
                        "cluster": cluster,
                    }
                    log.debug("Added node mapping for %s: %s", node, node_mapping[node])

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

        # Handle different possible response formats
        if data.get("latest_timestamp"):
            timestamp_str = data["latest_timestamp"]
            # Parse ISO format timestamp and ensure it's timezone-aware
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        else:
            log.info(
                "No latest timestamp found for cluster_id=%d, will start from %dh ago",
                cluster_id,
                COLLECTION_WINDOW_HOURS,
            )
            return None
    except Exception as e:
        log.warning(
            "Failed to get latest timestamp for cluster_id=%d: %s", cluster_id, e
        )
        return None


def get_latest_hourly_timestamp(cluster_id: int) -> Optional[datetime]:
    """
    Get the latest timestamp including hour precision for hourly collections.
    This is used specifically for hourly window tracking.
    Returns None if no data exists.
    """
    url = f"{BACKEND_API_URL}/v1/latest-timestamp"
    try:
        params = {"cluster_id": cluster_id, "include_hours": True}  # Add parameter to indicate we want hour precision
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()

        if data.get("latest_timestamp"):
            timestamp_str = data["latest_timestamp"]
            # Parse ISO format timestamp and ensure it's timezone-aware
            dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            
            log.info("Latest hourly timestamp for cluster %d: %s", cluster_id, dt.isoformat())
            return dt
        else:
            log.info(
                "No latest hourly timestamp found for cluster_id=%d",
                cluster_id
            )
            return None
    except Exception as e:
        log.warning(
            "Failed to get latest hourly timestamp for cluster_id=%d: %s", 
            cluster_id, 
            e
        )
        return None

def get_missing_hourly_windows(cluster_id: int, after_timestamp: datetime) -> List[tuple[datetime, datetime]]:
    """
    Get missing hourly windows after a specific timestamp.
    This is used to fill hourly data after the daily windows are complete.
    Creates precise 1-hour windows from the latest timestamp up to the current hour.
    """
    log.info("\n" + "="*50)
    log.info("HOURLY WINDOWS CALCULATION STARTED")
    log.info("="*50)
    
    windows = []
    
    # Get current time rounded down to the nearest hour
    now = datetime.now(timezone.utc)
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    log.info("Current hour (UTC): %s", current_hour.isoformat())
    
    # Get the most recent hourly timestamp
    latest_hourly = get_latest_hourly_timestamp(cluster_id)
    log.info("Latest hourly timestamp: %s", latest_hourly.isoformat() if latest_hourly else "None")
    
    start_from = after_timestamp
    log.info("Starting from timestamp: %s", start_from.isoformat())
    
    # Ensure timezone-aware comparison
    if start_from.tzinfo is None:
        start_from = start_from.replace(tzinfo=timezone.utc)
    
    if latest_hourly:
        # Calculate gaps from both timestamps
        time_diff_latest = current_hour - latest_hourly
        time_diff_start = current_hour - start_from
        hours_behind_latest = time_diff_latest.total_seconds() / 3600
        hours_behind_start = time_diff_start.total_seconds() / 3600
        
        log.info("Hours behind from latest hourly: %.2f", hours_behind_latest)
        log.info("Hours behind from start: %.2f", hours_behind_start)
        
        # Use the earlier timestamp to ensure we don't miss any data
        if start_from < latest_hourly:
            log.info("Using earlier timestamp: %s", start_from.isoformat())
        else:
            log.info("Using latest hourly timestamp: %s", latest_hourly.isoformat())
            start_from = latest_hourly
    
    # Round down the start timestamp to the nearest hour
    current_start = latest_hourly.replace(minute=0, second=0, microsecond=0) if latest_hourly else start_from.replace(minute=0, second=0, microsecond=0)
    
    # If the rounded time is after our start time, go back one hour to ensure we don't miss any data
    if current_start > start_from:
        current_start = current_start - timedelta(hours=1)
    
    log.info("Starting hourly window collection from: %s to %s", 
             current_start.isoformat(), current_hour.isoformat())
    
    # Create 1-hour windows up to current_hour
    while current_start < current_hour:
        next_hour = current_start + timedelta(hours=1)
        if next_hour > current_hour:
            next_hour = current_hour
        windows.append((current_start, next_hour))
        current_start = next_hour

    if windows:
        log.info("Found %d hourly windows to collect:", len(windows))
        for start, end in windows:
            log.info("Hourly window: %s -> %s", start.isoformat(), end.isoformat())
    else:
        log.info("No hourly windows needed")
    
    return windows

def get_missing_windows(cluster_id: int) -> List[tuple[datetime, datetime]]:
    """
    Get all missing daily time windows that need to be backfilled.
    Returns a list of (start_time, end_time) tuples using COLLECTION_WINDOW_HOURS (24h).
    """
    windows = []
    latest_timestamp = get_latest_timestamp(cluster_id)
    now = helper.round_down_time(
        datetime.now(timezone.utc), timedelta(hours=COLLECTION_WINDOW_HOURS)
    )

    log.info("Checking for daily windows")
    log.info("Latest timestamp from DB: %s", latest_timestamp.isoformat() if latest_timestamp else None)
    log.info("Current time (rounded to %dh): %s", COLLECTION_WINDOW_HOURS, now.isoformat())

    if latest_timestamp is None:
        # First run - collect up to MAX_BACKFILL_WINDOWS windows (default = 7)
        log.info("No previous data - collecting initial daily windows")
        end_time = now - timedelta(days=MAX_BACKFILL_WINDOWS_END)
        log.info("End time", end_time)

        for i in range(MAX_BACKFILL_WINDOWS, 0, -1):
            start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)
            windows.append((start_time, end_time))
            end_time = start_time
        windows = list(reversed(windows))

    else:
        # Normal case - catch up from latest_timestamp to now using daily windows
        if latest_timestamp.tzinfo is None:
            latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

        current_start = latest_timestamp
        while current_start < now - timedelta(days=MAX_BACKFILL_WINDOWS_END):
            current_end = current_start + timedelta(hours=COLLECTION_WINDOW_HOURS)
            if current_end > now:
                break
            windows.append((current_start, current_end))
            current_start = current_end

    if windows:
        log.info("Found %d daily windows to collect:", len(windows))
        for start, end in windows:
            log.info("Daily window: %s -> %s", start.isoformat(), end.isoformat())
    else:
        log.info("No daily windows needed")

    return windows




def calculate_next_run_time(cluster_id: int) -> Optional[datetime]:
    """Calculate when the next collection should run based on last saved timestamp."""
    log.info("\n" + "="*70)
    log.info("CALCULATING NEXT RUN TIME".center(70))
    log.info("="*70)
    
    latest_timestamp = get_latest_timestamp(cluster_id)
    now = datetime.now(timezone.utc)
    
    log.info("\nTIME ANALYSIS:")
    log.info("-"*50)
    log.info("Cluster ID: %d", cluster_id)
    log.info("Current time (UTC): %s", now.isoformat())
    log.info("Latest timestamp: %s", latest_timestamp.isoformat() if latest_timestamp else "None")
    log.info("-"*50)

    if latest_timestamp is None:
        # First run - schedule immediately
        return now + timedelta(seconds=30)

    # Ensure timezone-aware comparison
    if latest_timestamp.tzinfo is None:
        latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

    # Next collection should happen at latest_timestamp + window_hours
    next_expected_window = latest_timestamp + timedelta(hours=HOURLY_COLLECTION_WINDOW)
    log.info("\nSchedule Calculation:")
    log.info("-"*50)
    log.info("Next expected window: %s", next_expected_window.isoformat())
    log.info("Window hours: %d", HOURLY_COLLECTION_WINDOW)

    # If that time has already passed, schedule immediately to catch up
    if next_expected_window <= now:
        immediate_run = now + timedelta(seconds=30)
        log.info("Next window has passed - scheduling immediate run in 30 seconds")
        log.info("Immediate run time: %s", immediate_run.isoformat())
        return immediate_run

    # Don't schedule too far into the future (safety check)
    max_future = now + timedelta(hours=HOURLY_COLLECTION_WINDOW * 2)
    log.info("Maximum allowed future time: %s", max_future.isoformat())
    
    if next_expected_window > max_future:
        log.warning(
            "Next run time too far in future for cluster_id=%d, scheduling in %d minutes",
            cluster_id,
            MIN_SCHEDULE_INTERVAL_MIN,
        )
        adjusted_time = now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)
        log.info("Adjusted run time to minimum interval: %s", adjusted_time.isoformat())
        return adjusted_time

    log.info("\nFinal Schedule Decision:")
    log.info("-"*50)
    log.info("Selected run time: %s", next_expected_window.isoformat())
    log.info("Time until execution: %s", next_expected_window - now)
    log.info("="*70)
    
    return next_expected_window



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
                False
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


def collect_cluster_data(cluster_cfg: Dict) -> None:
    """
    Smart collection for a single cluster - handles backfilling and current data.
    First collects daily windows, then fills in hourly gaps.
    Ensures sequential processing: daily data first, then hourly data.
    """
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    
    try:
        log.info("\n=== PHASE 1: Daily Window Collection ===")
        # First get and collect daily windows
        daily_windows = get_missing_windows(cluster_id)
        latest_successful_time = None

        if not daily_windows:
            log.info("No daily windows needed | cluster=%s", cluster_name)
        else:
            log.info(
                "Found %d daily windows to collect | cluster=%s",
                len(daily_windows),
                cluster_name,
            )
            log.info("Processing daily windows sequentially...")

            # Collect each daily window
            daily_success_count = 0
            
            for start_time, end_time in daily_windows:
                if collect_window(cluster_cfg, start_time, end_time):
                    daily_success_count += 1
                    latest_successful_time = end_time
                else:
                    # Stop on first failure to maintain data continuity
                    log.error(
                        "Stopping daily collection due to failed window | cluster=%s",
                        cluster_name,
                    )
                    break

            log.info(
                "Collected %d/%d daily windows | cluster=%s",
                daily_success_count,
                len(daily_windows),
                cluster_name,
            )

        # Now check for hourly windows after the last successful daily window
        # or from the latest timestamp if no daily windows were needed
        log.info("\n=== Starting Hourly Window Collection ===")
        
        # Calculate where hourly windows should start
        # This should be where daily windows ended (now - MAX_BACKFILL_WINDOWS_END days)
        now = datetime.now(timezone.utc)
        hourly_start = now - timedelta(days=MAX_BACKFILL_WINDOWS_END)
        
        # If we have more recent data (from successful daily collection or existing hourly data),
        # use that instead to avoid gaps
        if latest_successful_time and latest_successful_time > hourly_start:
            hourly_start = latest_successful_time
            
        latest_hourly = get_latest_hourly_timestamp(cluster_id)
        if latest_hourly and latest_hourly > hourly_start:
            hourly_start = latest_hourly
        
        log.info("Starting hourly collection from timestamp: %s", 
                hourly_start.isoformat())
        
        if hourly_start:
            hourly_windows = get_missing_hourly_windows(cluster_id, hourly_start)
            
            if hourly_windows:
                log.info(
                    "Found %d hourly windows to collect | cluster=%s",
                    len(hourly_windows),
                    cluster_name,
                )
                
                # Collect each hourly window
                hourly_success_count = 0
                for start_time, end_time in hourly_windows:
                    if collect_window(cluster_cfg, start_time, end_time):
                        hourly_success_count += 1
                    else:
                        log.error(
                            "Stopping hourly collection due to failed window | cluster=%s",
                            cluster_name,
                        )
                        break
                        
                log.info(
                    "Collected %d/%d hourly windows | cluster=%s",
                    hourly_success_count,
                    len(hourly_windows),
                    cluster_name,
                )
            else:
                log.info("No hourly windows needed | cluster=%s", cluster_name)

    except Exception as e:
        log.error("Cluster collection failed | cluster=%s err=%s", cluster_name, e)


# -------------------- Time-based Data Collection --------------------

def fetch_timestamp_data(cluster_cfg: Dict, start_time: datetime, end_time: datetime) -> bool:
    """
    Fetch and send data for a specific time interval.
    Returns True if successful, False otherwise.
    """
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    
    try:
        log.info(
            "Fetching timestamp data | cluster=%s | start=%s | end=%s",
            cluster_name,
            start_time.isoformat(),
            end_time.isoformat()
        )
        
        # Fetch data from Kubecost
        data, node_mapping, pod_mapping = fetch_kubecost_window(
            cluster_cfg["kubecost_api_url"],
            start_time,
            end_time,
            cluster_cfg.get("username", ""),
            cluster_cfg.get("password", "")
        )
        
        if not data.get("data", {}).get("sets", []):
            log.warning(
                "No data for interval | cluster=%s | start=%s | end=%s",
                cluster_name,
                start_time.isoformat(),
                end_time.isoformat()
            )
            return True
            
        # Send to backend
        send_snapshots_to_backend(
            cluster_cfg["user_id"],
            cluster_id,
            data,
            start_time,
            end_time,
            node_mapping,
            pod_mapping,
            False
        )
        
        log.info(
            "Successfully processed interval | cluster=%s | start=%s | end=%s",
            cluster_name,
            start_time.isoformat(),
            end_time.isoformat()
        )
        return True
        
    except Exception as e:
        log.error(
            "Failed to process interval | cluster=%s | start=%s | end=%s | error=%s",
            cluster_name,
            start_time.isoformat(),
            end_time.isoformat(),
            str(e)
        )
        return False
    

# -------------------- Scheduler Management --------------------
JOB_PREFIX = "cluster-"


def collect_and_reschedule(cluster_cfg: Dict, scheduler: BackgroundScheduler) -> None:
    """Collect data and schedule the next run based on the new timestamp."""
    log.info("\n" + "*"*80)
    log.info("COLLECTION AND RESCHEDULING PROCESS STARTED".center(80))
    log.info("*"*80)
    
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    
    log.info("\nCLUSTER DETAILS:")
    log.info("-"*50)
    log.info("Cluster Name: %s", cluster_name)
    log.info("Cluster ID: %d", cluster_id)
    log.info("-"*50)

    try:
        log.info("\nPHASE 1: DATA COLLECTION")
        log.info("-"*50)
        collect_cluster_data(cluster_cfg)
        log.info("Data collection completed successfully")

        log.info("\nPHASE 2: SCHEDULING NEXT RUN")
        log.info("-"*50)
        next_run_time = calculate_next_run_time(cluster_id)
        
        if next_run_time:
            # Avoid scheduling if next run is too soon (prevents infinite loops)
            now = datetime.now(timezone.utc)
            min_interval = now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)
            
            log.info("Scheduling Analysis:")
            log.info("  Current time (UTC): %s", now.isoformat())
            log.info("  Minimum allowed interval: %s", min_interval.isoformat())

            if next_run_time < min_interval:
                next_run_time = min_interval
                log.info(
                    "Adjusted next run time to respect minimum interval | cluster=%s next_run=%s",
                    cluster_name,
                    next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
                )

            job_id = f"{JOB_PREFIX}{cluster_id}"
            scheduler.add_job(
                func=collect_and_reschedule,
                id=job_id,
                args=[cluster_cfg, scheduler],
                trigger="date",
                run_date=next_run_time,
                replace_existing=True,
            )
            log.info(
                "Rescheduled next collection | cluster=%s next_run=%s",
                cluster_name,
                next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
            )

    except Exception as e:
        log.error(
            "Collection and reschedule failed | cluster=%s err=%s", cluster_name, e
        )
        retry_time = datetime.now(timezone.utc) + timedelta(
            minutes=MIN_SCHEDULE_INTERVAL_MIN
        )
        job_id = f"{JOB_PREFIX}{cluster_id}"
        scheduler.add_job(
            func=collect_and_reschedule,
            id=job_id,
            args=[cluster_cfg, scheduler],
            trigger="date",
            run_date=retry_time,
            replace_existing=True,
        )
        log.info(
            "Scheduled retry after error | cluster=%s retry_at=%s",
            cluster_name,
            retry_time.strftime("%Y-%m-%d %H:%M:%S"),
        )


def schedule_cluster_jobs(scheduler: BackgroundScheduler, clusters: List[Dict]):
    """
    Schedule jobs based on the next expected data window for each cluster.
    Instead of interval triggers, each job is scheduled once at the exact
    `next_run_time` and then re-schedules itself inside `collect_and_reschedule`.
    """
    log.info("\n" + "#"*80)
    log.info("CLUSTER JOB SCHEDULING".center(80))
    log.info("#"*80)
    
    log.info("\nINITIAL SETUP:")
    log.info("-"*50)
    log.info("Total clusters to schedule: %d", len(clusters))
    log.info("Scheduling type: One-time with auto-reschedule")
    log.info("-"*50)
    
    for cfg in clusters:
        log.info("\nProcessing Cluster:")
        log.info("-"*40)
        log.info("Cluster Name: %s", cfg.get("cluster_name", f"id-{cfg['cluster_id']}"))
        log.info("Cluster ID: %d", cfg["cluster_id"])
        
        # figure out when this cluster should next run
        next_run_time = calculate_next_run_time(cfg["cluster_id"])
        if not next_run_time:
            log.warning(
                "No next run time calculated for cluster_id=%s", cfg["cluster_id"]
            )
            continue

        job_id = f"{JOB_PREFIX}{cfg['cluster_id']}"
        
        log.info("\nScheduling Details:")
        log.info("-"*40)
        log.info("Job ID: %s", job_id)
        log.info("Scheduled Run Time: %s", next_run_time.isoformat())
        log.info("Time until execution: %s", next_run_time - datetime.now(timezone.utc))
        
        scheduler.add_job(
            func=collect_and_reschedule,
            id=job_id,
            args=[cfg, scheduler],
            trigger="date",
            run_date=next_run_time,
            replace_existing=True,
        )
        
        log.info("Job successfully scheduled")
        log.info("-"*40)


def initial_collect_all(scheduler: BackgroundScheduler):
    """
    Run an initial collection on startup for all clusters to catch up on any missing data.
    Also collects hourly data for today for each cluster after its initial collection.
    """
    clusters = get_active_clusters()
    log.info("Starting initial collection for %d clusters", len(clusters))

    for cfg in clusters:
        try:
            # First do the historical data collection
            collect_cluster_data(cfg)
            
          
            log.info(
                "Starting hourly collection after initial data | cluster=%s",
                cfg.get("cluster_name", f"id-{cfg['cluster_id']}")
            )
            
        except Exception as e:
            log.error(
                "Collection failed | cluster_id=%s err=%s",
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
    
    # Import and start revision scheduler
    start_revision_scheduler, _ = import_revision_scheduler()
    revision_scheduler = start_revision_scheduler(scheduler)

    # run_revision_for_all_clusters()

    # graceful shutdown
    def shutdown(signum, frame):
        log.info("\n" + "="*70)
        log.info("SHUTTING DOWN SCHEDULERS".center(70))
        log.info("="*70)
        
        log.info("Shutting down main scheduler...")
        scheduler.shutdown(wait=True)
        
        # Import and shutdown data revision scheduler
        _, shutdown_revision_scheduler = import_revision_scheduler()
        shutdown_revision_scheduler()
        
        log.info("All schedulers shut down successfully")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # initial bootstrapping (includes both historical and hourly data)
    initial_collect_all(scheduler)
    
    # Initialize data revision scheduler
    log.info("\nInitializing data revision scheduler...")
    revision_scheduler = start_revision_scheduler(scheduler)
    
    log.info(
        "Enhanced scheduler started | Backend=%s window=%d hours max_backfill=%d min_interval=%d min",
        BACKEND_API_URL,
        COLLECTION_WINDOW_HOURS,
        MAX_BACKFILL_WINDOWS,
        MIN_SCHEDULE_INTERVAL_MIN,
    )
    log.info("Data revision scheduler enabled - runs daily at 00:00 UTC")

    # keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown("KeyboardInterrupt", None)


if __name__ == "__main__":
    main()

# -------------------- FastAPI Endpoints --------------------

# @app.get("/health", response_model=HealthResponse)
# async def health_check():
#     """Health check endpoint"""
#     return HealthResponse(
#         status="healthy",
#         service="kubecost-scheduler-api",
#         timestamp=datetime.now(timezone.utc).isoformat()
#     )

# @app.post("/api/trigger-collection", response_model=TriggerResponse)
# async def trigger_collection(request: TriggerRequest, background_tasks: BackgroundTasks):
#     """
#     Trigger collect_cluster_data function for specified cluster(s)
    
#     - cluster_id: Optional cluster ID. If not provided, runs for all clusters
#     """
#     try:
#         # Get cluster configurations
#         clusters = get_active_clusters()
#         if not clusters:
#             raise HTTPException(
#                 status_code=404, 
#                 detail="No active clusters found"
#             )
        
#         # Filter by cluster_id if provided
#         if request.cluster_id:
#             clusters = [c for c in clusters if c['cluster_id'] == request.cluster_id]
#             if not clusters:
#                 raise HTTPException(
#                     status_code=404,
#                     detail=f"Cluster ID {request.cluster_id} not found"
#                 )
        
#         # Add collection task to background
#         background_tasks.add_task(run_collection_task, clusters)
        
#         return TriggerResponse(
#             status="success",
#             message="Collection triggered successfully",
#             clusters=[
#                 {
#                     "cluster_id": c['cluster_id'],
#                     "cluster_name": c.get('cluster_name', f"id-{c['cluster_id']}")
#                 } for c in clusters
#             ]
#         )
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         log.error(f"API trigger failed: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to trigger collection: {str(e)}"
#         )

# @app.get("/api/clusters")
# async def get_clusters():
#     """Get list of active clusters"""
#     try:
#         clusters = get_active_clusters()
#         return {
#             "status": "success",
#             "clusters": [
#                 {
#                     "cluster_id": c['cluster_id'],
#                     "cluster_name": c.get('cluster_name', f"id-{c['cluster_id']}"),
#                     "kubecost_api_url": c.get('kubecost_api_url', '')
#                 } for c in clusters
#             ]
#         }
#     except Exception as e:
#         log.error(f"Failed to get clusters: {e}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"Failed to get clusters: {str(e)}"
#         )

# # -------------------- Background Tasks --------------------

# async def run_collection_task(clusters: List[Dict]):
#     """
#     Background task to run collection for specified clusters
#     """
#     results = []
    
#     for cluster_cfg in clusters:
#         try:
#             cluster_name = cluster_cfg.get('cluster_name', f"id-{cluster_cfg['cluster_id']}")
#             log.info(f"API triggered collection for cluster: {cluster_name}")
            
#             # Run the collection function in a thread to avoid blocking
#             def run_collection():
#                 collect_cluster_data(cluster_cfg)
            
#             # Run in thread pool to avoid blocking the async event loop
#             loop = asyncio.get_event_loop()
#             await loop.run_in_executor(None, run_collection)
            
#             log.info(f"API collection completed for cluster: {cluster_name}")
#             results.append({
#                 "cluster_id": cluster_cfg['cluster_id'],
#                 "cluster_name": cluster_name,
#                 "status": "success"
#             })
            
#         except Exception as e:
#             log.error(f"API collection failed for cluster {cluster_cfg['cluster_id']}: {e}")
#             results.append({
#                 "cluster_id": cluster_cfg['cluster_id'],
#                 "cluster_name": cluster_cfg.get('cluster_name', f"id-{cluster_cfg['cluster_id']}"),
#                 "status": "error",
#                 "error": str(e)
#             })
    
#     log.info(f"Background collection task completed. Results: {results}")
#     return results


# # -------------------- Server Management --------------------

# class UvicornServer:
#     """Manage Uvicorn server in a separate thread"""
#     def __init__(self, config: uvicorn.Config):
#         self.server = uvicorn.Server(config)
#         self.config = config

#     def run_in_thread(self):
#         """Run server in background thread"""
#         self.server.run()

#     def start(self):
#         """Start server in background thread"""
#         self.thread = threading.Thread(target=self.run_in_thread, daemon=True)
#         self.thread.start()
#         log.info(f"FastAPI server started on {self.config.host}:{self.config.port}")

#     def stop(self):
#         """Stop the server"""
#         if hasattr(self, 'server'):
#             self.server.should_exit = True


# # -------------------- Main --------------------
# def main():
#     jobstores = {"default": MemoryJobStore()}
#     executors = {"default": ThreadPoolExecutor(max_workers=10)}
#     job_defaults = {"coalesce": True, "max_instances": 1}
#     scheduler = BackgroundScheduler(
#         jobstores=jobstores, executors=executors, job_defaults=job_defaults
#     )
#     scheduler.start()


 # start the FastAPI server in a separate thread

#     # Start FastAPI server
#     config = uvicorn.Config(
#         app,
#         host=API_HOST,
#         port=API_PORT,
#         log_level="info",
#         access_log=False
#     )
#     server = UvicornServer(config)
#     server.start()


#     FastAPI Ends

#     # graceful shutdown
#     def shutdown(signum, frame):
#         log.info("Shutting down scheduler and API server (signal=%s)...", signum)
#         server.stop()
#         scheduler.shutdown(wait=True)
#         sys.exit(0)

#     signal.signal(signal.SIGINT, shutdown)
#     signal.signal(signal.SIGTERM, shutdown)

#     # initial bootstrapping
#     initial_collect_all(scheduler)

#     log.info(
#         "Enhanced scheduler with API started | Backend=%s window=%d hours max_backfill=%d min_interval=%d min | API=%s:%d",
#         BACKEND_API_URL,
#         COLLECTION_WINDOW_HOURS,
#         MAX_BACKFILL_WINDOWS,
#         MIN_SCHEDULE_INTERVAL_MIN,
#         API_HOST,
#         API_PORT,
#     )

#     # keep main thread alive
#     try:
#         while True:
#             time.sleep(1)
#     except KeyboardInterrupt:
#         shutdown("KeyboardInterrupt", None)


# if __name__ == "__main__":
#     main()