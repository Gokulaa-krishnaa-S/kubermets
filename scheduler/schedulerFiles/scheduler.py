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
  MAX_BACKFILL_WINDOWS=15           # max number of 24h windows to backfill in one run
  MIN_SCHEDULE_INTERVAL_MIN=15     # minimum interval between collections (minutes)
"""

import os
import sys
import time
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import requests
requests.packages.urllib3.disable_warnings()
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore

# -------------------- Config --------------------
from dotenv import load_dotenv
from helpers.hepler import HelperClass
from helpers.formatting import dataFormatter
from schedulerFiles.datarevision import run_revision_for_all_clusters

# Import common utilities from utils.py
from schedulerFiles.utils import (
    get_active_clusters,
    fetch_kubecost_window,
    send_snapshots_to_backend,
    collect_window,
    BACKEND_API_URL,
    REQUEST_TIMEOUT_SEC,
    COLLECTION_WINDOW_HOURS,
    HOURLY_COLLECTION_WINDOW
)

# Import revision scheduler functions conditionally to avoid circular imports
def import_revision_scheduler():
    from schedulerFiles.datarevision import start_revision_scheduler, shutdown_revision_scheduler
    return start_revision_scheduler, shutdown_revision_scheduler

formatter = dataFormatter()
helper = HelperClass()
load_dotenv()

# -------------------- Additional Config (not in utils) --------------------
RETRY_ATTEMPTS = int(os.getenv("RETRY_ATTEMPTS", "3"))
RETRY_DELAY_SEC = int(os.getenv("RETRY_DELAY_SEC", "15"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
MAX_BACKFILL_WINDOWS = int(os.getenv("MAX_BACKFILL_WINDOWS", "15"))
MIN_SCHEDULE_INTERVAL_MIN = int(os.getenv("MIN_SCHEDULE_INTERVAL_MIN", "15"))
CLUSTER_ID = int(os.getenv("CLUSTER_ID", "1"))
CLUSTER_NAME = (os.getenv("CLUSTER_NAME", "cluster_one"))
USER_ID = (os.getenv("USER_ID", "1"))
USERNAME = (os.getenv("USERNAME", "admin"))
PASSWORD = (os.getenv("PASSWORD", "Admin@12#$"))                  
KUBECOST_API_URL = (os.getenv("KUBECOST_API_URL", "")) 
MAX_BACKFILL_WINDOWS_END = int(os.getenv("MAX_BACKFILL_WINDOWS_END", "7"))

# -------------------- Logging --------------------
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("kubecost-scheduler")


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
        params = {"cluster_id": cluster_id, "include_hours": True}
        resp = requests.get(url, params=params, timeout=REQUEST_TIMEOUT_SEC)
        resp.raise_for_status()
        data = resp.json()

        if data.get("latest_timestamp"):
            timestamp_str = data["latest_timestamp"]
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
    
    now = datetime.now(timezone.utc)
    current_hour = now.replace(minute=0, second=0, microsecond=0)
    log.info("Current hour (UTC): %s", current_hour.isoformat())
    
    latest_hourly = get_latest_hourly_timestamp(cluster_id)
    log.info("Latest hourly timestamp: %s", latest_hourly.isoformat() if latest_hourly else "None")
    
    start_from = after_timestamp
    log.info("Starting from timestamp: %s", start_from.isoformat())
    
    if start_from.tzinfo is None:
        start_from = start_from.replace(tzinfo=timezone.utc)
    
    if latest_hourly:
        time_diff_latest = current_hour - latest_hourly
        time_diff_start = current_hour - start_from
        hours_behind_latest = time_diff_latest.total_seconds() / 3600
        hours_behind_start = time_diff_start.total_seconds() / 3600
        
        log.info("Hours behind from latest hourly: %.2f", hours_behind_latest)
        log.info("Hours behind from start: %.2f", hours_behind_start)
        
        if start_from < latest_hourly:
            log.info("Using earlier timestamp: %s", start_from.isoformat())
        else:
            log.info("Using latest hourly timestamp: %s", latest_hourly.isoformat())
            start_from = latest_hourly
    
    current_start = latest_hourly.replace(minute=0, second=0, microsecond=0) if latest_hourly else start_from.replace(minute=0, second=0, microsecond=0)
    
    if current_start > start_from:
        current_start = current_start - timedelta(hours=1)
    
    log.info("Starting hourly window collection from: %s to %s", 
             current_start.isoformat(), current_hour.isoformat())
    
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
        log.info("No previous data - collecting initial daily windows")
        end_time = now - timedelta(days=MAX_BACKFILL_WINDOWS_END)
        log.info("End time %s", end_time)

        for i in range(MAX_BACKFILL_WINDOWS, 0, -1):
            start_time = end_time - timedelta(hours=COLLECTION_WINDOW_HOURS)
            windows.append((start_time, end_time))
            end_time = start_time
        windows = list(reversed(windows))

    else:
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
        return now + timedelta(seconds=30)

    if latest_timestamp.tzinfo is None:
        latest_timestamp = latest_timestamp.replace(tzinfo=timezone.utc)

    next_expected_window = latest_timestamp + timedelta(hours=HOURLY_COLLECTION_WINDOW)
    log.info("\nSchedule Calculation:")
    log.info("-"*50)
    log.info("Next expected window: %s", next_expected_window.isoformat())
    log.info("Window hours: %d", HOURLY_COLLECTION_WINDOW)

    if next_expected_window <= now:
        immediate_run = now + timedelta(seconds=30)
        log.info("Next window has passed - scheduling immediate run in 30 seconds")
        log.info("Immediate run time: %s", immediate_run.isoformat())
        return immediate_run

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

            daily_success_count = 0
            
            for start_time, end_time in daily_windows:
                if collect_window(cluster_cfg, start_time, end_time,False):
                    daily_success_count += 1
                    latest_successful_time = end_time
                else:
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

        log.info("\n=== Starting Hourly Window Collection ===")
        
        now = datetime.now(timezone.utc)
        hourly_start = now - timedelta(days=MAX_BACKFILL_WINDOWS_END)
        
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
                
                hourly_success_count = 0
                for start_time, end_time in hourly_windows:
                    if collect_window(cluster_cfg, start_time, end_time,False):
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


# -------------------- Scheduler Management --------------------
JOB_PREFIX = "cluster-"


def collect_and_reschedule(cluster_cfg: Dict, scheduler: BackgroundScheduler) -> None:
    """Collect data and schedule the next run with dynamic logic:
       - If current time has passed expected window → run again in 15 minutes.
       - Otherwise → schedule next run in 1 hour.
    """
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
        # === Phase 1: Data Collection ===
        log.info("\nPHASE 1: DATA COLLECTION")
        log.info("-"*50)
        collect_cluster_data(cluster_cfg)
        log.info("Data collection completed successfully")

        # === Phase 2: Scheduling Logic ===
        log.info("\nPHASE 2: SCHEDULING NEXT RUN")
        log.info("-"*50)

        now = datetime.now(timezone.utc)
        expected_next_run = calculate_next_run_time(cluster_id)

        # Fallback: if calculation fails, default to now
        if not expected_next_run:
            expected_next_run = now

        log.info("Current time (UTC): %s", now.isoformat())
        log.info("Expected next run (UTC): %s", expected_next_run.isoformat())

        # Case 1: Current time has already passed expected run window
        if expected_next_run <= now:
            next_run_time = now + timedelta(minutes=15)
            log.warning(
                "Next run time already passed — scheduling quick retry in 15 minutes | new_run=%s",
                next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
            )
        else:
            # Case 2: Normal cycle — schedule next run in 1 hour
            next_run_time = now + timedelta(hours=1)
            log.info(
                "Scheduling normal hourly run | next_run=%s",
                next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # Ensure respect for the minimum interval
        min_interval = now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)
        if next_run_time < min_interval:
            next_run_time = min_interval
            log.info(
                "Adjusted next run time to respect minimum interval | cluster=%s next_run=%s",
                cluster_name,
                next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
            )

        # Schedule the next job
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
        retry_time = datetime.now(timezone.utc) + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)
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


def schedule_cluster_jobs(scheduler: BackgroundScheduler, clusters: list, job_prefix: str):
    """
    Schedule cluster jobs safely:
    - Only one job per cluster is active.
    - Respects MIN_SCHEDULE_INTERVAL_MIN.
    - Avoids running missed jobs immediately on scheduler start.
    """
    scheduler.remove_all_jobs()

    for cfg in clusters:
        cluster_id = cfg["cluster_id"]
        cluster_name = cfg.get("cluster_name", f"id-{cluster_id}")
        job_id = f"{job_prefix}{cluster_id}"

        next_run_time = calculate_next_run_time(cluster_id)
        if not next_run_time:
            continue

        now = datetime.now(timezone.utc)
        min_allowed_time = now + timedelta(minutes=MIN_SCHEDULE_INTERVAL_MIN)

        if next_run_time < min_allowed_time:
            next_run_time = min_allowed_time

        scheduler.add_job(
            func=collect_and_reschedule,
            id=job_id,
            args=[cfg, scheduler],
            trigger="date",
            run_date=next_run_time,
            replace_existing=True,
            misfire_grace_time=60
        )

        log.info(
            "Scheduled cluster job | cluster=%s next_run=%s",
            cluster_name,
            next_run_time.strftime("%Y-%m-%d %H:%M:%S"),
        )

        
def initial_collect_all(scheduler: BackgroundScheduler, job_prefix: str = "collect_job_"):
    """
    Run an initial collection on startup for all clusters to catch up on any missing data.
    """
    clusters = get_active_clusters()
    log.info("Starting initial collection for %d clusters", len(clusters))

    for cfg in clusters:
        try:
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

    schedule_cluster_jobs(scheduler, clusters, job_prefix=job_prefix)


# -------------------- Main --------------------
def schedulerMain():
    jobstores = {"default": MemoryJobStore()}
    executors = {"default": ThreadPoolExecutor(max_workers=10)}
    job_defaults = {"coalesce": True, "max_instances": 1}
    scheduler = BackgroundScheduler(
        jobstores=jobstores, executors=executors, job_defaults=job_defaults
    )
    scheduler.start()
    
    # Import and start revision scheduler ONCE, after scheduler is ready
    def import_revision_scheduler():
        from schedulerFiles.datarevision import start_revision_scheduler, shutdown_revision_scheduler
        return start_revision_scheduler, shutdown_revision_scheduler

    start_revision_scheduler, _ = import_revision_scheduler()
    log.info("Initializing data revision scheduler...")
    revision_scheduler = start_revision_scheduler(scheduler)  # Single call here
    log.info("Data revision scheduler enabled - runs daily at 00:00 UTC")
    
    initial_collect_all(scheduler)
    run_revision_for_all_clusters() 
    
    log.info(
        "Enhanced scheduler started | Backend=%s window=%d hours max_backfill=%d min_interval=%d min",
        BACKEND_API_URL,
        COLLECTION_WINDOW_HOURS,
        MAX_BACKFILL_WINDOWS,
        MIN_SCHEDULE_INTERVAL_MIN,
    )

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Shutting down scheduler...")
        scheduler.shutdown()