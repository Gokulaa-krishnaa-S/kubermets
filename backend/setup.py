# setup.py - Database initialization and migration script
import sys
import logging
from dotenv import load_dotenv
from sqlalchemy import text, func
 
load_dotenv()
from models import db_manager
# from service.data_service import kubecost_service
# from models import ClusterMetrics, NodeMetrics, PodMetrics  # 
from models.model import ClusterMetrics, NodeMetrics, PodMetrics 

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# alembic revision --autogenerate -m "Updates of metrics tables"
# alembic upgrade head
 
 
class DatabaseSetup:
    def __init__(self):
        self.db_manager = db_manager
 
    def create_database_tables(self):
        """Create all database tables"""
        try:
            logger.info("Creating database tables...")
            self.db_manager.create_tables()
            logger.info("Database tables created successfully!")
            return True
        except Exception as e:
            logger.error(f"Error creating database tables: {str(e)}")
            return False
 
    def drop_database_tables(self):
        """Drop all database tables (use with caution!)"""
        try:
            logger.info("Dropping database tables...")
            self.db_manager.drop_tables()
            logger.info("Database tables dropped successfully!")
            return True
        except Exception as e:
            logger.error(f"Error dropping database tables: {str(e)}")
            return False
 
    def initial_data_load(self):
        """Load initial data from Kubecost API"""
        try:
            logger.info("Starting initial data load...")
 
            windows = ["1h", "24h", "7d"]
 
            for window in windows:
                logger.info(f"Loading cluster data for window: {window}")
                # kubecost_service.get_cluster_data(window=window, force_refresh=True)
 
                logger.info(f"Loading node data for window: {window}")
                # kubecost_service.get_node_data(window=window, force_refresh=True)
 
                logger.info(f"Loading pod data for window: {window}")
                # kubecost_service.get_pod_data(window=window, force_refresh=True)
 
            logger.info("Initial data load completed successfully!")
            return True
 
        except Exception as e:
            logger.error(f"Error during initial data load: {str(e)}")
            return False
 
    def setup_periodic_cleanup_job(self):
        """Set up periodic cleanup job (placeholder for actual scheduler)"""
        logger.info("Setting up periodic cleanup job...")
        logger.info("Periodic cleanup job setup completed!")
        return True
 
    def verify_database_connection(self):
        """Verify database connection"""
        try:
            session = self.db_manager.get_session()
            session.execute(text("SELECT 1"))
            session.close()
            logger.info("Database connection verified successfully!")
            return True
        except Exception as e:
            logger.error(f"Database connection failed: {str(e)}")
            return False
 
    def get_database_stats(self):
        """Get database statistics"""
        session = self.db_manager.get_session()
        try:
            stats = {
                "cluster_metrics": session.query(func.count(ClusterMetrics.id)).scalar(),
                "node_metrics": session.query(func.count(NodeMetrics.id)).scalar(),
                "pod_metrics": session.query(func.count(PodMetrics.id)).scalar(),
            }
 
            logger.info("Database Statistics:")
            for key, value in stats.items():
                logger.info(f"  {key}: {value}")
 
            return stats
        except Exception as e:
            logger.error(f"Error getting database stats: {str(e)}")
            return {}
        finally:
            session.close()
 
 
def main():
    """Main setup function"""
    setup = DatabaseSetup()
 
    if len(sys.argv) > 1:
        command = sys.argv[1]
 
        if command == "create":
            if setup.verify_database_connection():
                setup.create_database_tables()
            else:
                logger.error("Database connection failed. Please check your DATABASE_URL.")
                sys.exit(1)
 
        elif command == "drop":
            confirmation = input("Are you sure you want to drop all tables? (yes/no): ")
            if confirmation.lower() == "yes":
                setup.drop_database_tables()
            else:
                logger.info("Operation cancelled.")
 
        elif command == "migrate":
            confirmation = input("This will drop and recreate all tables. Continue? (yes/no): ")
            if confirmation.lower() == "yes":
                setup.drop_database_tables()
                setup.create_database_tables()
                logger.info("Migration completed!")
            else:
                logger.info("Migration cancelled.")
 
        elif command == "init":
            if setup.verify_database_connection():
                setup.create_database_tables()
                setup.initial_data_load()
                setup.setup_periodic_cleanup_job()
            else:
                logger.error("Database connection failed.")
                sys.exit(1)
 
        elif command == "load":
            setup.initial_data_load()
 
        elif command == "update":
            logger.info("Generating new migration...")
            import subprocess
 
            subprocess.run(["alembic", "revision", "--autogenerate", "-m", "Auto migration"])
            logger.info("Applying database migrations...")
            subprocess.run(["alembic", "upgrade", "head"])
            logger.info("Database updated successfully!")
 
        elif command == "stats":
            setup.get_database_stats()
 
        elif command == "cleanup":
            days_to_keep = int(sys.argv[2]) if len(sys.argv) > 2 else 30
            # kubecost_service.cleanup_old_data(days_to_keep)
 
        else:
            print("Available commands:")
            print("  create  - Create database tables")
            print("  drop    - Drop database tables")
            print("  migrate - Drop and recreate tables")
            print("  init    - Full initialization (create tables + load data)")
            print("  load    - Load initial data from Kubecost API")
            print("  stats   - Show database statistics")
            print("  cleanup [days] - Cleanup data older than N days (default: 30)")
    else:
        print("Usage: python database_setup.py <command>")
        print("Run 'python database_setup.py help' for available commands")
 
 
if __name__ == "__main__":
    main()
 
 