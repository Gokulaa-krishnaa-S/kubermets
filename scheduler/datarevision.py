#!/usr/bin/env python3
"""
datarevision.py - Daily Data Revision Scheduler
Runs every day at midnight (00:00 UTC) to revise and resend the last 24 hours of data
with clear flag set to true for data cleanup.
"""

import os
import sys
import logging
import time
import signal
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Tuple
import requests
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.triggers.cron import CronTrigger

# Import shared utilities
from utils import (
    get_active_clusters,
    collect_window,
    BACKEND_API_URL,
    REQUEST_TIMEOUT_SEC
)



# -------------------- Logging --------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("kubecost-data-revision")

def revise_cluster_data(cluster_cfg: Dict) -> None:
    """
    Revise and resend data from 3 days ago to 2 days ago with clear flag.
    Example: If today is 24th, collect data from 21st 00:00 to 22nd 00:00
    """
    log.info("\n" + "="*80)
    log.info("DATA REVISION PROCESS STARTED".center(80))
    log.info("="*80)
    
    cluster_id = cluster_cfg["cluster_id"]
    cluster_name = cluster_cfg.get("cluster_name", f"id-{cluster_id}")
    
    try:
        # Calculate the time window (3 days ago to 2 days ago)
        now = datetime.now(timezone.utc)
        # Start with beginning of current day
        current_day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        # Go back 3 days to get start time
        start_time = current_day_start - timedelta(days=4)
        # End time is 2 days ago (1 day after start)
        end_time = start_time + timedelta(days=2)
        
        log.info("\nREVISION DETAILS:")
        log.info("-"*50)
        log.info("Cluster: %s (ID: %d)", cluster_name, cluster_id)
        log.info("Current Time: %s", now.isoformat())
        log.info("Revising 3 days ago data:")
        log.info("Start Time: %s (3 days ago)", start_time.isoformat())
        log.info("End Time: %s (2 days ago)", end_time.isoformat())
        log.info("Window Duration: 24 hours")
        log.info("-"*50)
        
        log.info("\nFETCHING DATA")
        log.info("-"*50)
        
        collect_window(cluster_cfg, start_time, end_time)
        log.info("Data successfully fetched")
        
        log.info("\nSENDING REVISION DATA")
        log.info("-"*50)
        
        log.info("Data revision completed successfully")
        log.info("="*80)
        
    except Exception as e:
        log.error(
            "Data revision failed | cluster=%s | error=%s",
            cluster_name,
            str(e)
        )
def run_revision_for_all_clusters():
    """
    Run data revision for all active clusters.
    """
    log.info("\n" + "#"*80)
    log.info("DAILY DATA REVISION STARTED".center(80))
    log.info("#"*80)
    
    clusters = get_active_clusters()
    log.info("\nFound %d clusters for revision", len(clusters))
    
    for cfg in clusters:
        try:
            revise_cluster_data(cfg)
        except Exception as e:
            log.error(
                "Revision failed for cluster %s: %s",
                cfg.get("cluster_name", f"id-{cfg['cluster_id']}"),
                e
            )
    
    log.info("\nDAILY REVISION COMPLETED")
    log.info("#"*80)

def start_revision_scheduler(parent_scheduler: Optional[BackgroundScheduler] = None) -> BackgroundScheduler:
    """
    Set up and start the revision scheduler.
    Can use an existing scheduler or create a new one.
    Returns the scheduler instance.
    """
    log.info("\n" + "#"*80)
    log.info("INITIALIZING DATA REVISION SCHEDULER".center(80))
    log.info("#"*80)
    
    # Use existing scheduler or create new one
    scheduler = parent_scheduler
    if scheduler is None:
        jobstores = {"default": MemoryJobStore()}
        executors = {"default": ThreadPoolExecutor(max_workers=10)}
        job_defaults = {"coalesce": True, "max_instances": 1}
        
        scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults
        )
        log.info("Created new scheduler instance")
    
    # Schedule the job to run at midnight UTC
    
    
    # Calculate time until next run
    now = datetime.now(timezone.utc)
    next_run = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if next_run <= now:
        next_run += timedelta(hours=0.07)
    log.info("\nnext_run: %s", next_run)

    log.info("\nSCHEDULER CONFIGURATION:")
    log.info("-"*50)
    log.info("Current time (UTC): %s", now.isoformat())
    log.info("Next revision run: %s", next_run.isoformat())
    log.info("Time until next run: %s", next_run - now)
    log.info("-"*50)

    # scheduler.add_job(
    #     run_revision_for_all_clusters,
    #     trigger=CronTrigger(minute="*/2"),  # every 2 minutes
    #     id='daily_revision',
    #     name='Daily Data Revision',
    #     replace_existing=True
    # )

    scheduler.add_job(
        run_revision_for_all_clusters,
        trigger=CronTrigger(hour=0, minute=0),  # midnight UTC
        id='daily_revision',
        name='Daily Data Revision',
        replace_existing=True
    )
    # Only start if we created a new scheduler
    if parent_scheduler is None:
        scheduler.start()
        log.info("Started new scheduler instance")
    
    log.info("Data revision scheduler initialized successfully")
    log.info("Next run at: %s UTC", next_run.isoformat())
    log.info("#"*80)
    
    # Store the scheduler instance for shutdown access
    global revision_scheduler
    revision_scheduler = scheduler
    return scheduler

def shutdown_revision_scheduler():
    """Gracefully shut down the revision scheduler."""
    global revision_scheduler
    if revision_scheduler:
        log.info("\n" + "="*70)
        log.info("SHUTTING DOWN DATA REVISION SCHEDULER".center(70))
        log.info("="*70)
        revision_scheduler.shutdown(wait=True)
        log.info("Data revision scheduler shutdown completed")
        revision_scheduler = None

# Allow running as standalone script
if __name__ == "__main__":
    revision_scheduler = start_revision_scheduler()
    
    # Graceful shutdown handler
    def shutdown(signum, frame):
        log.info("Shutting down revision scheduler...")
        revision_scheduler.shutdown(wait=True)
        sys.exit(0)
    
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        shutdown(None, None)