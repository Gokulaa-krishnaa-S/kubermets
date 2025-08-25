from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    JSON,
    Index,
    ForeignKey,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime


from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSON
import os


Base = declarative_base()


# ================================
# ClusterMetrics Table
# ================================
class ClusterMetrics(Base):
    __tablename__ = "cluster_metrics"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=True)
    cluster_id = Column(Integer, nullable=True)
    # Cluster identification
    cluster_name = Column(String(100), nullable=False)

    # Time window information
    timestamp = Column(DateTime, nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    window_duration = Column(String(10), nullable=False)  # 1h, 6h, 24h, 7d, 30d

    # Cost metrics
    total_cost = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)
    cpu_cost_idle = Column(Float, default=0.0)
    ram_cost = Column(Float, default=0.0)
    ram_cost_idle = Column(Float, default=0.0)
    pv_cost = Column(Float, default=0.0)
    network_cost = Column(Float, default=0.0)
    gpu_cost = Column(Float, default=0.0)
    gpu_cost_idle = Column(Float, default=0.0)
    load_balancer_cost = Column(Float, default=0.0)
    external_cost = Column(Float, default=0.0)
    shared_cost = Column(Float, default=0.0)

    # CPU metrics
    cpu_core_request_average = Column(Float, default=0.0)
    cpu_core_usage_average = Column(Float, default=0.0)

    # Memory metrics
    ram_byte_request_average = Column(Float, default=0.0)
    ram_byte_usage_average = Column(Float, default=0.0)

    # GPU metrics
    gpu_request_average = Column(Float, default=0.0)
    gpu_usage_average = Column(Float, default=0.0)

    # Efficiency metrics
    total_efficiency = Column(Float, default=0.0)

    # Computed fields
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)
    memory_gb_used = Column(Float, default=0.0)
    memory_gb_requested = Column(Float, default=0.0)
    efficiency_percent = Column(Float, default=0.0)

    # Cluster status
    cluster_status = Column(String(20), default="running")
    cluster_version = Column(String(50), default="N/A")

    # Node/Pod information
    node_count = Column(Integer, default=0)
    pod_count = Column(Integer, default=0)

    # Efficiency classification
    efficiency_category = Column(String(20))

    # API response metadata
    is_idle_allocation = Column(Boolean, default=False)

    # Record metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_api_response = Column(JSON)
    unique_id = Column(String(100))
    query_params = Column(JSON)
    fetch_timestamp = Column(DateTime)
    nodes = relationship(
        "NodeMetrics", back_populates="cluster", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_cluster_name_time", "cluster_name", "timestamp"),
        Index("idx_cluster_window_duration", "window_duration"),
        Index("idx_efficiency_category", "efficiency_category"),
        Index("idx_cluster_status", "cluster_status"),
        Index("idx_cluster_window_start_end", "window_start", "window_end"),
        Index("idx_is_idle", "is_idle_allocation"),
    )


# ================================
# NodeMetrics Table
# ================================
class NodeMetrics(Base):
    __tablename__ = "node_metrics"

    id = Column(Integer, primary_key=True)
    cluster_id = Column(Integer, ForeignKey("cluster_metrics.id"), nullable=False)
    user_id = Column(Integer, nullable=False)
    # Node identification
    node_name = Column(String(255), nullable=False)
    cluster_name = Column(String(100), nullable=False)

    # Time window
    timestamp = Column(DateTime, nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    window_duration = Column(String(10), nullable=False)

    # Cost metrics
    total_cost = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)
    cpu_cost_idle = Column(Float, default=0.0)
    ram_cost = Column(Float, default=0.0)
    ram_cost_idle = Column(Float, default=0.0)
    pv_cost = Column(Float, default=0.0)
    network_cost = Column(Float, default=0.0)
    gpu_cost = Column(Float, default=0.0)
    gpu_cost_idle = Column(Float, default=0.0)
    load_balancer_cost = Column(Float, default=0.0)
    external_cost = Column(Float, default=0.0)
    shared_cost = Column(Float, default=0.0)

    # CPU metrics
    cpu_core_request_average = Column(Float, default=0.0)
    cpu_core_usage_average = Column(Float, default=0.0)

    # Memory metrics
    ram_byte_request_average = Column(Float, default=0.0)
    ram_byte_usage_average = Column(Float, default=0.0)

    # GPU metrics
    gpu_request_average = Column(Float, default=0.0)
    gpu_usage_average = Column(Float, default=0.0)

    # Efficiency
    total_efficiency = Column(Float, default=0.0)

    # Computed fields
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)
    memory_gb_used = Column(Float, default=0.0)
    memory_gb_requested = Column(Float, default=0.0)
    efficiency_percent = Column(Float, default=0.0)

    # Node status & health
    node_status = Column(String(20), default="Healthy")
    node_health_score = Column(Float, default=100.0)

    # Node specifications
    node_instance_type = Column(String(50))
    node_zone = Column(String(50))

    # Special node types
    is_idle_allocation = Column(Boolean, default=False)
    is_unallocated = Column(Boolean, default=False)
    is_system_allocation = Column(Boolean, default=False)

    # Lifecycle
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    cluster = relationship("ClusterMetrics", back_populates="nodes")
    pods = relationship(
        "PodMetrics", back_populates="node", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_node_name_time", "node_name", "timestamp"),
        Index("idx_cluster_name", "cluster_name"),
        # idx_node_pool missing column, left out unless you want to add node_pool field
        Index("idx_node_window_duration", "window_duration"),
        Index("idx_node_status", "node_status"),
        # idx_efficiency_category missing column, left out unless you want to add efficiency_category
        # idx_cost_category missing column, left out unless you want to add cost_category
        Index("idx_node_window_start_end", "window_start", "window_end"),
        Index("idx_is_active", "is_active"),
        Index("idx_is_system_allocation", "is_system_allocation"),
        Index("idx_total_cost", "total_cost"),
        Index("idx_node_health", "node_health_score"),
        Index("idx_last_seen", "last_seen"),
        Index("idx_cluster_active_time", "cluster_name", "is_active", "timestamp"),
        Index("idx_node_window_active", "node_name", "window_duration", "is_active"),
    )


# ================================
# PodMetrics Table
# ================================
class PodMetrics(Base):
    __tablename__ = "pod_metrics"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("node_metrics.id"), nullable=True)
    user_id = Column(Integer, nullable=True)
    cluster_id = Column(Integer, nullable=True)
    # Identification
    key = Column(String(255), nullable=False)
    namespace = Column(String(100), nullable=True)  # Added (index exists)
    name = Column(String(100), nullable=True)  # Added (index exists)
    timestamp = Column(DateTime, nullable=False)
    # Time window
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    window = Column(String(10), nullable=False)

    # CPU metrics
    cpu_core_usage_average = Column(Float, default=0.0)
    cpu_core_request_average = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)

    # Memory metrics
    ram_byte_usage_average = Column(Float, default=0.0)
    ram_byte_request_average = Column(Float, default=0.0)
    ram_cost = Column(Float, default=0.0)

    # GPU metrics
    gpu_cost = Column(Float, default=0.0)
    gpu_cost_idle = Column(Float, default=0.0)
    gpu_request_average = Column(Float, default=0.0)
    gpu_usage_average = Column(Float, default=0.0)

    # Storage
    pv_cost = Column(Float, default=0.0)
    pv_bytes = Column(Float, default=0.0)

    # Additional costs
    cpu_cost_idle = Column(Float, default=0.0)
    ram_cost_idle = Column(Float, default=0.0)
    external_cost = Column(Float, default=0.0)
    load_balancer_cost = Column(Float, default=0.0)
    network_cost = Column(Float, default=0.0)

    # Cost breakdown
    total_cost = Column(Float, default=0.0)
    shared_cost = Column(Float, default=0.0)

    # Derived fields
    ram_usage_gb = Column(Float, default=0.0)
    ram_request_gb = Column(Float, default=0.0)
    cpu_efficiency = Column(Float, default=0.0)
    ram_efficiency = Column(Float, default=0.0)
    total_efficiency = Column(Float, default=0.0)

    # Flags
    is_idle = Column(Boolean, default=False)

    # Query context
    domain = Column(String(255), nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_allocation_data = Column(JSON, nullable=True)
    node = relationship("NodeMetrics", back_populates="pods")
    __table_args__ = (
        Index("idx_pod_key_window", "key", "window", "timestamp"),
        Index("idx_pod_namespace_name", "namespace", "name"),
        Index("idx_pod_time_window", "start_time", "end_time", "window"),
        Index("idx_pod_domain_window", "domain", "window"),
        Index("idx_pod_costs", "total_cost", "cpu_cost", "ram_cost"),
        Index(
            "idx_pod_efficiency", "total_efficiency", "cpu_efficiency", "ram_efficiency"
        ),
        Index("idx_pod_idle", "is_idle"),
    )


# Database connection setup
class DatabaseManager:
    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL")
        self.engine = create_engine(self.database_url, echo=False)
        self.SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=self.engine
        )

    def create_tables(self):
        """Create all tables in the database"""
        Base.metadata.create_all(bind=self.engine)

    def get_session(self):
        """Get a database session"""
        return self.SessionLocal()

    def drop_tables(self):
        """Drop all tables (use with caution!)"""
        Base.metadata.drop_all(bind=self.engine)


# Initialize database manager
db_manager = DatabaseManager()
