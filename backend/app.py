# app.py - Updated with database integration
import os
from flask import Flask, Response, jsonify, request
from flasgger import Swagger
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from datetime import datetime
import atexit
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Import your modules
from routes.cluster import clusters_bp
from models.model import db_manager
from service.data_service import kubecost_service

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def create_app():
    """Application factory"""
    app = Flask(__name__)

    # Enable CORS
    CORS(app)

    # Configure Flask
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")

    # Register blueprints
    app.register_blueprint(clusters_bp)

    # Setup Swagger documentation
    swagger = Swagger(app, template_file="./docs/swagger.yaml")

    # Initialize database
    try:
        # Verify database connection on startup
        session = db_manager.get_session()
        session.execute(text("SELECT 1"))
        session.close()
        logger.info("Database connection established successfully")
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        logger.error(
            "Please ensure PostgreSQL is running and DATABASE_URL is correctly configured"
        )

    # Setup background tasks if enabled
    enable_background = (
        os.getenv("ENABLE_BACKGROUND_REFRESH", "false").lower() == "true"
    )
    if enable_background:
        setup_background_tasks(app)

    return app


def setup_background_tasks(app):
    """Setup background tasks for periodic data refresh"""
    try:
        scheduler = BackgroundScheduler()
        refresh_interval = float(os.getenv("REFRESH_INTERVAL_MINUTES", "10"))

        # Schedule periodic data refresh
        scheduler.add_job(
            func=background_data_refresh,
            trigger="interval",
            minutes=refresh_interval,
            id="data_refresh_job",
            name="Refresh Kubecost data",
            replace_existing=True,
        )

        # Schedule daily cleanup
        # scheduler.add_job(
        #     func=background_cleanup,
        #     trigger="cron",
        #     hour=2,  # Run at 2 AM
        #     minute=0,
        #     id='cleanup_job',
        #     name='Cleanup old data',
        #     replace_existing=True
        # )

        scheduler.start()
        logger.info(
            f"Background scheduler started with {refresh_interval} minute refresh interval"
        )

        # Shut down scheduler when app exits
        atexit.register(lambda: scheduler.shutdown())

        # Store scheduler in app context for potential access
        app.scheduler = scheduler

    except Exception as e:
        logger.error(f"Failed to setup background tasks: {str(e)}")


def background_data_refresh():
    """Background job to refresh data from Kubecost API"""
    try:
        logger.info("Starting background data refresh...")

        # Refresh data for common time windows
        windows = ["1h", "24h", "7d"]

        for window in windows:
            try:
                # Refresh cluster data
                kubecost_service.get_cluster_data(window=window, force_refresh=True)

                # Refresh node data
                kubecost_service.get_node_data(window=window, force_refresh=True)

                # Refresh pod data
                kubecost_service.get_pod_data(window=window, force_refresh=True)

                logger.info(f"Refreshed data for window: {window}")

            except Exception as e:
                logger.error(f"Error refreshing data for window {window}: {str(e)}")

        logger.info("Background data refresh completed")

    except Exception as e:
        logger.error(f"Background data refresh failed: {str(e)}")


app = create_app()


# Add some utility routes
@app.route("/api/health")
def health_check():
    """Comprehensive health check endpoint"""
    try:
        # Check database connection
        session = db_manager.get_session()
        session.execute(text("SELECT 1"))
        session.close()
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    # Check Kubecost API connection
    try:
        import requests

        kubecost_domain = os.getenv("domain")
        if kubecost_domain:
            response = requests.get(f"{kubecost_domain}/model/allocation", timeout=5)
            kubecost_status = (
                "healthy"
                if response.status_code == 200
                else f"unhealthy: {response.status_code}"
            )
        else:
            kubecost_status = "not configured"
    except Exception as e:
        kubecost_status = f"unhealthy: {str(e)}"

    health_data = {
        "status": (
            "healthy"
            if db_status == "healthy" and "healthy" in kubecost_status
            else "unhealthy"
        ),
        "timestamp": datetime.utcnow().isoformat(),
        "services": {"database": db_status, "kubecost_api": kubecost_status},
        "background_tasks": {
            "enabled": os.getenv("ENABLE_BACKGROUND_REFRESH", "false").lower()
            == "true",
            "refresh_interval_minutes": int(
                os.getenv("REFRESH_INTERVAL_MINUTES", "10")
            ),
            "data_retention_days": int(os.getenv("DATA_RETENTION_DAYS", "30")),
        },
    }

    status_code = 200 if health_data["status"] == "healthy" else 503
    return jsonify(health_data), status_code


@app.route("/api/info")
def api_info():
    """API information endpoint"""
    return jsonify(
        {
            "name": "Kubecost Monitoring API",
            "version": "1.0.0",
            "description": "Flask API with PostgreSQL caching layer for Kubecost metrics",
            "endpoints": {
                "cluster_status": "/v1/clusters/status",
                "unified_api": "/v1/all",
                "pod_details": "/v1/get_pod_details",
                "node_info": "/v1/clusters/nodes",
                "dashboard_summary": "/v1/dashboard/summary",
                "cache_status": "/v1/cache/status",
                "health_check": "/api/health",
            },
            "documentation": "/apidocs/",
        }
    )


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    logger.info(f"Starting Kubecost Monitoring API on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
