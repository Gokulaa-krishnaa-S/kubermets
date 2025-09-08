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

import requests

requests.packages.urllib3.disable_warnings()
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore

# -------------------- Config --------------------
from dotenv import load_dotenv
from helpers.hepler import HelperClass
from helpers.formatting import dataFormatter


formatter = dataFormatter()
helper = HelperClass()
load_dotenv()

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000")
COLLECTION_WINDOW_HOURS = float(os.getenv("COLLECTION_WINDOW_HOURS", "24"))
REQUEST_TIMEOUT_SEC = int(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_BACKFILL_WINDOWS = int(os.getenv("MAX_BACKFILL_WINDOWS", "7"))
MIN_SCHEDULE_INTERVAL_MIN = int(os.getenv("MIN_SCHEDULE_INTERVAL_MIN", "30"))
CLUSTER_ID = int(os.getenv("CLUSTER_ID", "1"))
CLUSTER_NAME = os.getenv("CLUSTER_NAME", "cluster_one")
USER_ID = os.getenv("USER_ID", "1")
USERNAME = os.getenv("USERNAME", "admin")
PASSWORD = os.getenv("PASSWORD", "Admin@12#$")
KUBECOST_API_URL = os.getenv("KUBECOST_API_URL", "")


# -------------------- Logging --------------------
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("kubecost-scheduler")


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


# def get_missing_windows(cluster_id: int) -> List[tuple[datetime, datetime]]:
#     """
#     Get all missing time windows that need to be backfilled.
#     Returns a list of (start_time, end_time) tuples.
#     """
#     windows = []
#     latest_timestamp = get_latest_timestamp(cluster_id)
#     now = helper.round_down_time(
#         datetime.now(timezone.utc), timedelta(hours=COLLECTION_WINDOW_HOURS)
#     )

#     if latest_timestamp is None:
#         # First run - collect up to MAX_BACKFILL_WINDOWS windows (default = 7)
#         end_time = now
#         for i in range(MAX_BACKFILL_WINDOWS, 0, -1):
#             start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)
#             windows.append((start_time, end_time))
#             end_time = start_time

#         return list(reversed(windows))

#     # Normal case - catch up from latest_timestamp to now
#     # Ensure latest_timestamp is timezone-aware
#     if latest_timestamp.tzinfo is None:
#         latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

#     current_start = latest_timestamp
#     while current_start < now:
#         current_end = current_start + timedelta(hours=COLLECTION_WINDOW_HOURS)
#         if current_end > now:
#             break
#         windows.append((current_start, current_end))
#         current_start = current_end
#     return windows


def get_missing_windows(cluster_id: int) -> List[tuple[datetime, datetime]]:
    """
    Get all missing time windows that need to be backfilled.
    Returns a list of (start_time, end_time) tuples, always ending at 'now'.
    """
    windows = []
    latest_timestamp = get_latest_timestamp(cluster_id)
    now = datetime.now(timezone.utc)  # ✅ exact current time
    print("nooo timestamps here")
    if latest_timestamp is None:
        # First run - build windows backwards but ensure last one ends at "now"
        start_time = now
        for _ in range(MAX_BACKFILL_WINDOWS):
            end_time = start_time + timedelta(hours=COLLECTION_WINDOW_HOURS)
            windows.append((start_time, end_time))
            start_time = end_time
        return windows
    print(":timestamp exitssssssssssssssssssssssss")
    # Normal case - catch up from latest_timestamp to now
    if latest_timestamp.tzinfo is None:
        latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

    current_start = latest_timestamp
    while current_start < now:
        current_end = current_start + timedelta(hours=COLLECTION_WINDOW_HOURS)
        if current_end > now:
            windows.append((current_start, now))  # ✅ end at now
            break
        windows.append((current_start, current_end))
        current_start = current_end
    print(windows, "[[[[[[[[[[[[[[[[[[[[[]]]]]]]]]]]]]]]]]]]]]")
    return windows


def calculate_next_run_time(cluster_id: int) -> Optional[datetime]:
    """Calculate when the next collection should run based on last saved timestamp."""
    latest_timestamp = get_latest_timestamp(cluster_id)
    now = datetime.now(timezone.utc)

    if latest_timestamp is None:
        # First run - schedule immediately
        return now + timedelta(seconds=30)

    # Ensure timezone-aware comparison
    if latest_timestamp.tzinfo is None:
        latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

    # Next collection should happen at latest_timestamp + window_hours
    next_expected_window = latest_timestamp + timedelta(hours=COLLECTION_WINDOW_HOURS)

    # If that time has already passed, schedule immediately to catch up
    if next_expected_window <= now:
        return now + timedelta(seconds=30)

    # Don't schedule too far into the future (safety check)
    max_future = now + timedelta(hours=COLLECTION_WINDOW_HOURS * 2)
    if next_expected_window > max_future:
        log.warning(
            "Next run time too far in future for cluster_id=%d, scheduling in %d minutes",
            cluster_id,
            MIN_SCHEDULE_INTERVAL_MIN,
        )
        return now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)

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
        print("Final request URL:", r.url)
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
) -> None:
    """
    Format and POST snapshots to App 1 ingestion endpoint with window metadata and enhanced mapping.
    """
    url = f"{BACKEND_API_URL}/v1/fetchMetrics"

    # Format the data according to schema with enhanced mapping

    formatted_payload = formatter.format_kubecost_response(
        kubecost_data, user_id, cluster_id, node_mapping, pod_mapping
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
    # log.info(formatted_payload, len(str(formatted_payload)))
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
    """
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")

    try:
        # Get all missing windows that need to be collected
        missing_windows = get_missing_windows(cluster_id)

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


def collect_and_reschedule(cluster_cfg: Dict, scheduler: BackgroundScheduler) -> None:
    """Collect data and schedule the next run based on the new timestamp."""
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")

    try:
        # Collect missing data
        collect_cluster_data(cluster_cfg)

        # Calculate and schedule next run
        next_run_time = calculate_next_run_time(cluster_id)
        if next_run_time:
            # Avoid scheduling if next run is too soon (prevents infinite loops)
            now = datetime.now(timezone.utc)
            min_interval = now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)

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
        # Retry in minimum interval on error
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
    for cfg in clusters:
        # figure out when this cluster should next run
        next_run_time = calculate_next_run_time(cfg["cluster_id"])
        if not next_run_time:
            log.warning(
                "No next run time calculated for cluster_id=%s", cfg["cluster_id"]
            )
            continue

        job_id = f"{JOB_PREFIX}{cfg['cluster_id']}"
        scheduler.add_job(
            func=collect_and_reschedule,
            id=job_id,
            args=[cfg, scheduler],
            trigger="date",
            run_date=next_run_time,
            replace_existing=True,
        )
        log.info(
            "Scheduled smart collection job | %s at %s",
            job_id,
            next_run_time.isoformat(),
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
        "Enhanced scheduler started | Backend=%s window=%d hours max_backfill=%d min_interval=%d min",
        BACKEND_API_URL,
        COLLECTION_WINDOW_HOURS,
        MAX_BACKFILL_WINDOWS,
        MIN_SCHEDULE_INTERVAL_MIN,
    )

    # keep main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown("KeyboardInterrupt", None)


if __name__ == "__main__":
    main()
