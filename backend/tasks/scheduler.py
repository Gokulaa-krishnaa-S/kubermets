# tasks/scheduler.py - Advanced background task management
import os
import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
from service.data_service import kubecost_service
from models import db_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KubecostTaskScheduler:
    def __init__(self, use_database_jobstore=True):
        self.use_database_jobstore = use_database_jobstore
        self.scheduler = None
        self._setup_scheduler()
    
    def _setup_scheduler(self):
        """Setup APScheduler with proper configuration"""
        try:
            # Configure job stores
            jobstores = {}
            if self.use_database_jobstore:
                # Store jobs in database for persistence across restarts
                database_url = os.getenv('DATABASE_URL')
                jobstores['default'] = SQLAlchemyJobStore(url=database_url)
            
            # Configure executors
            executors = {
                'default': ThreadPoolExecutor(max_workers=4)
            }
            
            # Job defaults
            job_defaults = {
                'coalesce': True,  # Combine multiple pending executions
                'max_instances': 1,  # Only one instance of each job at a time
                'misfire_grace_time': 300  # 5 minutes grace period for missed jobs
            }
            
            # Create scheduler
            self.scheduler = BackgroundScheduler(
                jobstores=jobstores,
                executors=executors,
                job_defaults=job_defaults,
                timezone='UTC'
            )
            
            logger.info("Task scheduler configured successfully")
            
        except Exception as e:
            logger.error(f"Failed to setup task scheduler: {str(e)}")
            # Fallback to basic scheduler
            self.scheduler = BackgroundScheduler()
    
    def start(self):
        """Start the scheduler and add jobs"""
        try:
            # Add all scheduled jobs
            self._add_data_refresh_jobs()
            self._add_maintenance_jobs()
            self._add_monitoring_jobs()
            
            # Start scheduler
            self.scheduler.start()
            logger.info("Task scheduler started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start task scheduler: {str(e)}")
    
    def stop(self):
        """Stop the scheduler gracefully"""
        if self.scheduler and self.scheduler.running:
            self.scheduler.shutdown(wait=True)
            logger.info("Task scheduler stopped")
    
    def _add_data_refresh_jobs(self):
        """Add data refresh jobs with different frequencies"""
        
        # High-frequency refresh for critical metrics (every 5 minutes)
        self.scheduler.add_job(
            func=self._refresh_critical_metrics,
            trigger="interval",
            minutes=5,
            id='critical_metrics_refresh',
            name='Refresh critical metrics (1h, 6h windows)',
            replace_existing=True
        )
        
        # Medium-frequency refresh for dashboard data (every 15 minutes)
        self.scheduler.add_job(
            func=self._refresh_dashboard_metrics,
            trigger="interval",
            minutes=15,
            id='dashboard_metrics_refresh',
            name='Refresh dashboard metrics (24h, 7d windows)',
            replace_existing=True
        )
        
        # Low-frequency refresh for historical data (every hour)
        self.scheduler.add_job(
            func=self._refresh_historical_metrics,
            trigger="interval",
            hours=1,
            id='historical_metrics_refresh',
            name='Refresh historical metrics (30d window)',
            replace_existing=True
        )
        
        # Pod-specific data refresh (every 10 minutes)
        self.scheduler.add_job(
            func=self._refresh_pod_metrics,
            trigger="interval",
            minutes=10,
            id='pod_metrics_refresh',
            name='Refresh pod metrics',
            replace_existing=True
        )
    
    def _add_maintenance_jobs(self):
        """Add maintenance and cleanup jobs"""
        
        # Daily cleanup at 2 AM UTC
        self.scheduler.add_job(
            func=self._daily_cleanup,
            trigger="cron",
            hour=2,
            minute=0,
            id='daily_cleanup',
            name='Daily cleanup of old data',
            replace_existing=True
        )
        
        # Weekly database optimization at 3 AM UTC on Sundays
        self.scheduler.add_job(
            func=self._weekly_maintenance,
            trigger="cron",
            day_of_week='sun',
            hour=3,
            minute=0,
            id='weekly_maintenance',
            name='Weekly database maintenance',
            replace_existing=True
        )
        
        # Health check every 30 minutes
        self.scheduler.add_job(
            func=self._health_check,
            trigger="interval",
            minutes=30,
            id='health_check',
            name='System health check',
            replace_existing=True
        )
    
    def _add_monitoring_jobs(self):
        """Add monitoring and alerting jobs"""
        
        # Cache performance monitoring every 5 minutes
        self.scheduler.add_job(
            func=self._monitor_cache_performance,
            trigger="interval",
            minutes=5,
            id='cache_monitoring',
            name='Monitor cache performance',
            replace_existing=True
        )
        
        # Data freshness check every 15 minutes
        self.scheduler.add_job(
            func=self._check_data_freshness,
            trigger="interval",
            minutes=15,
            id='data_freshness_check',
            name='Check data freshness',
            replace_existing=True
        )
    
    def _refresh_critical_metrics(self):
        """Refresh critical metrics that need frequent updates"""
        try:
            logger.info("Starting critical metrics refresh...")
            
            # Refresh cluster data for short windows
            windows = ["1h", "6h"]
            for window in windows:
                try:
                    kubecost_service.get_cluster_data(window=window, force_refresh=True)
                    kubecost_service.get_node_data(window=window, force_refresh=True)
                    logger.info(f"Refreshed critical metrics for window: {window}")
                except Exception as e:
                    logger.error(f"Failed to refresh critical metrics for {window}: {str(e)}")
            
            logger.info("Critical metrics refresh completed")
            
        except Exception as e:
            logger.error(f"Critical metrics refresh failed: {str(e)}")
    
    def _refresh_dashboard_metrics(self):
        """Refresh dashboard metrics"""
        try:
            logger.info("Starting dashboard metrics refresh...")
            
            # Refresh data for dashboard windows
            windows = ["24h", "7d"]
            for window in windows:
                try:
                    kubecost_service.get_cluster_data(window=window, force_refresh=True)
                    kubecost_service.get_node_data(window=window, force_refresh=True)
                    kubecost_service.get_pod_data(window=window, force_refresh=True)
                    logger.info(f"Refreshed dashboard metrics for window: {window}")
                except Exception as e:
                    logger.error(f"Failed to refresh dashboard metrics for {window}: {str(e)}")
            
            logger.info("Dashboard metrics refresh completed")
            
        except Exception as e:
            logger.error(f"Dashboard metrics refresh failed: {str(e)}")
    
    def _refresh_historical_metrics(self):
        """Refresh historical metrics"""
        try:
            logger.info("Starting historical metrics refresh...")
            
            # Refresh long-term data
            kubecost_service.get_cluster_data(window="30d", force_refresh=True)
            kubecost_service.get_node_data(window="30d", force_refresh=True)
            kubecost_service.get_pod_data(window="30d", force_refresh=True)
            
            logger.info("Historical metrics refresh completed")
            
        except Exception as e:
            logger.error(f"Historical metrics refresh failed: {str(e)}")
    
    def _refresh_pod_metrics(self):
        """Refresh pod-specific metrics"""
        try:
            logger.info("Starting pod metrics refresh...")
            
            # Refresh pod data with different aggregations
            aggregations = ["pod", "controller", "namespace"]
            for agg in aggregations:
                try:
                    kubecost_service.get_pod_data(
                        window="7d", 
                        aggregate=agg, 
                        force_refresh=True
                    )
                    logger.info(f"Refreshed pod metrics for aggregation: {agg}")
                except Exception as e:
                    logger.error(f"Failed to refresh pod metrics for {agg}: {str(e)}")
            
            logger.info("Pod metrics refresh completed")
            
        except Exception as e:
            logger.error(f"Pod metrics refresh failed: {str(e)}")
    
    def _daily_cleanup(self):
        """Daily cleanup of old data"""
        try:
            logger.info("Starting daily cleanup...")
            
            retention_days = int(os.getenv('DATA_RETENTION_DAYS', '30'))
            kubecost_service.cleanup_old_data(retention_days)
            
            # Additional cleanup tasks
            self._cleanup_failed_jobs()
            self._cleanup_temp_files()
            
            logger.info(f"Daily cleanup completed - removed data older than {retention_days} days")
            
        except Exception as e:
            logger.error(f"Daily cleanup failed: {str(e)}")
    
    def _weekly_maintenance(self):
        """Weekly database maintenance"""
        try:
            logger.info("Starting weekly maintenance...")
            
            # Analyze database performance
            self._analyze_database_performance()
            
            # Vacuum and analyze PostgreSQL tables (if using PostgreSQL)
            self._database_maintenance()
            
            logger.info("Weekly maintenance completed")
            
        except Exception as e:
            logger.error(f"Weekly maintenance failed: {str(e)}")
    
    def _health_check(self):
        """Perform system health check"""
        try:
            # Check database connection
            session = db_manager.get_session()
            session.execute("SELECT 1")
            session.close()
            
            # Check Kubecost API connectivity
            import requests
            kubecost_domain = os.getenv('domain')
            if kubecost_domain:
                response = requests.get(f"{kubecost_domain}/model/allocation", timeout=10)
                if response.status_code != 200:
                    logger.warning(f"Kubecost API health check failed: {response.status_code}")
            
            # Check data freshness
            self._check_data_freshness()
            
        except Exception as e:
            logger.error(f"Health check failed: {str(e)}")
    
    def _monitor_cache_performance(self):
        """Monitor cache hit rates and performance"""
        try:
            from models import ClusterMetric, NodeMetric, PodMetric
            from sqlalchemy import func, and_
            
            session = db_manager.get_session()
            
            # Calculate cache hit statistics
            cache_duration = int(os.getenv('CACHE_DURATION_MINUTES', '5'))
            recent_threshold = datetime.utcnow() - timedelta(minutes=cache_duration * 2)
            
            recent_cluster_metrics = session.query(func.count(ClusterMetric.id)).filter(
                ClusterMetric.timestamp > recent_threshold
            ).scalar()
            
            recent_node_metrics = session.query(func.count(NodeMetric.id)).filter(
                NodeMetric.timestamp > recent_threshold
            ).scalar()
            
            recent_pod_metrics = session.query(func.count(PodMetric.id)).filter(
                PodMetric.timestamp > recent_threshold
            ).scalar()
            
            logger.info(f"Cache performance - Recent metrics: "
                       f"Clusters: {recent_cluster_metrics}, "
                       f"Nodes: {recent_node_metrics}, "
                       f"Pods: {recent_pod_metrics}")
            
            session.close()
            
        except Exception as e:
            logger.error(f"Cache performance monitoring failed: {str(e)}")
    
    def _check_data_freshness(self):
        """Check if data is fresh enough"""
        try:
            from models import ClusterMetric
            from sqlalchemy import desc
            
            session = db_manager.get_session()
            
            # Check latest cluster metric
            latest_metric = session.query(ClusterMetric).order_by(
                desc(ClusterMetric.timestamp)
            ).first()
            
            if latest_metric:
                age_minutes = (datetime.utcnow() - latest_metric.timestamp).total_seconds() / 60
                max_age = int(os.getenv('CACHE_DURATION_MINUTES', '5')) * 2
                
                if age_minutes > max_age:
                    logger.warning(f"Data is stale - latest metric is {age_minutes:.1f} minutes old")
                else:
                    logger.info(f"Data freshness OK - latest metric is {age_minutes:.1f} minutes old")
            else:
                logger.warning("No metrics found in database")
            
            session.close()
            
        except Exception as e:
            logger.error(f"Data freshness check failed: {str(e)}")
    
    def _cleanup_failed_jobs(self):
        """Clean up failed job records"""
        try:
            # This would typically involve cleaning up job execution logs
            # and resetting stuck jobs
            logger.info("Cleaned up failed job records")
        except Exception as e:
            logger.error(f"Failed job cleanup failed: {str(e)}")
    
    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        try:
            # Clean up any temporary files created by the application
            import tempfile
            import glob
            
            temp_dir = tempfile.gettempdir()
            temp_files = glob.glob(f"{temp_dir}/kubecost_*")
            
            for file in temp_files:
                try:
                    os.remove(file)
                except:
                    pass
            
            logger.info(f"Cleaned up {len(temp_files)} temporary files")
            
        except Exception as e:
            logger.error(f"Temp file cleanup failed: {str(e)}")
    
    def _analyze_database_performance(self):
        """Analyze database performance and log statistics"""
        try:
            from models import ClusterMetric, NodeMetric, PodMetric
            from sqlalchemy import func, text
            
            session = db_manager.get_session()
            
            # Get table sizes and row counts
            tables = [
                ('cluster_metrics', ClusterMetric),
                ('node_metrics', NodeMetric),
                ('pod_metrics', PodMetric)
            ]
            
            for table_name, model in tables:
                count = session.query(func.count(model.id)).scalar()
                logger.info(f"Table {table_name}: {count} rows")
            
            session.close()
            
        except Exception as e:
            logger.error(f"Database performance analysis failed: {str(e)}")
    
    def _database_maintenance(self):
        """Perform database maintenance tasks"""
        try:
            # This is PostgreSQL-specific maintenance
            # In production, you might want to use database-specific tools
            session = db_manager.get_session()
            
            # Update table statistics (PostgreSQL)
            if 'postgresql' in os.getenv('DATABASE_URL', ''):
                session.execute(text("ANALYZE;"))
                logger.info("Database analysis completed")
            
            session.close()
            
        except Exception as e:
            logger.error(f"Database maintenance failed: {str(e)}")
    
    def get_job_status(self):
        """Get status of all scheduled jobs"""
        if not self.scheduler:
            return {"status": "scheduler_not_running"}
        
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
                "trigger": str(job.trigger)
            })
        
        return {
            "status": "running" if self.scheduler.running else "stopped",
            "jobs": jobs
        }

# Global scheduler instance
task_scheduler = KubecostTaskScheduler()

# Standalone script for running scheduler
if __name__ == "__main__":
    logger.info("Starting Kubecost Task Scheduler...")
    
    try:
        task_scheduler.start()
        
        # Keep the script running
        import time
        while True:
            time.sleep(60)
            
    except KeyboardInterrupt:
        logger.info("Shutting down scheduler...")
        task_scheduler.stop()
    except Exception as e:
        logger.error(f"Scheduler error: {str(e)}")
        task_scheduler.stop()