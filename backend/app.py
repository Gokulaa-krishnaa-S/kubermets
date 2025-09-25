
# app.py - Updated with database integration
import os
from flask import Flask, jsonify
from flasgger import Swagger
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from datetime import datetime
from sqlalchemy import text

# Load environment variables
load_dotenv()

# Import your modules
from routes.cluster import clusters_bp
from routes.node import nodes_bp
from routes.pod import pods_bp   
from routes.helpers import helper_bp
from routes.melts import melts_bp

from models.model import db_manager

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
    app.register_blueprint(nodes_bp)  
    app.register_blueprint(pods_bp) 
    app.register_blueprint(helper_bp)
    app.register_blueprint(melts_bp)

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
        logger.error("Database connection failed: {}".format(str(e)))
        logger.error(
            "Please ensure PostgreSQL is running and DATABASE_URL is correctly configured"
        )

    return app


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
        db_status = "unhealthy: {}".format(str(e))

    health_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "services": {"database": db_status},
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
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"

    # logger.info(f"Starting Kubecost Monitoring API on port {port}")
    logger.info("Starting Kubecost Monitoring API on port {}".format(port))

    app.run(host="0.0.0.0", port=port, debug=debug)
