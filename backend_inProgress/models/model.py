# models.py
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Boolean,
    Text,
    ForeignKey,
    Index,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import JSON
from datetime import datetime
import os

Base = declarative_base()


class Cluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    status = Column(String(20), default="unknown")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    cluster_metrics = relationship(
        "ClusterMetric", back_populates="cluster", cascade="all, delete-orphan"
    )
    nodes = relationship("Node", back_populates="cluster", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=False)
    status = Column(String(20), default="unknown")
    cpu_capacity = Column(Float)
    memory_capacity = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    cluster = relationship("Cluster", back_populates="nodes")
    node_metrics = relationship(
        "NodeMetric", back_populates="node", cascade="all, delete-orphan"
    )
    pods = relationship("Pod", back_populates="node", cascade="all, delete-orphan")


class Pod(Base):
    __tablename__ = "pods"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    namespace = Column(String(100), nullable=False)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)
    controller_name = Column(String(100))
    controller_kind = Column(String(50))
    status = Column(String(20), default="unknown")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    node = relationship("Node", back_populates="pods")
    pod_metrics = relationship(
        "PodMetric", back_populates="pod", cascade="all, delete-orphan"
    )

    # Composite index for better query performance
    __table_args__ = (Index("idx_pod_namespace_name", "namespace", "name"),)


class ClusterMetric(Base):
    __tablename__ = "cluster_metrics"

    id = Column(Integer, primary_key=True)
    cluster_id = Column(Integer, ForeignKey("clusters.id"), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    window = Column(String(10), nullable=False)  # 1h, 6h, 24h, 7d, 30d

    # Cost metrics
    total_cost = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)
    memory_cost = Column(Float, default=0.0)
    storage_cost = Column(Float, default=0.0)
    network_cost = Column(Float, default=0.0)

    # Resource utilization
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)

    # Additional metadata
    raw_data = Column(JSON)  # Store full API response for debugging
    argument_hash = Column(String(255), nullable=True)
    query_params = Column(JSON, nullable=True)
    # Relationships
    cluster = relationship("Cluster", back_populates="cluster_metrics")

    # Composite index for time-based queries
    __table_args__ = (
        Index("idx_cluster_time_window", "cluster_id", "timestamp", "window"),
    )


class NodeMetric(Base):
    __tablename__ = "node_metrics"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    window = Column(String(10), nullable=False)

    # Cost metrics
    total_cost = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)
    memory_cost = Column(Float, default=0.0)
    storage_cost = Column(Float, default=0.0)

    # Resource utilization
    cpu_usage_percent = Column(Float, default=0.0)
    memory_usage_percent = Column(Float, default=0.0)
    cpu_efficiency = Column(Float, default=0.0)
    memory_efficiency = Column(Float, default=0.0)

    # Node health status
    is_healthy = Column(Boolean, default=True)

    # Additional metadata
    raw_data = Column(JSON)
    argument_hash = Column(String(255), nullable=True)
    query_params = Column(JSON, nullable=True)

    # Relationships
    node = relationship("Node", back_populates="node_metrics")

    # Composite index for time-based queries
    __table_args__ = (Index("idx_node_time_window", "node_id", "timestamp", "window"),)


class PodMetric(Base):
    __tablename__ = "pod_metrics"

    id = Column(Integer, primary_key=True)
    pod_id = Column(Integer, ForeignKey("pods.id"), nullable=True)
    timestamp = Column(DateTime, nullable=False)
    window = Column(String(10), nullable=False)

    # Cost metrics
    total_cost = Column(Float, default=0.0)
    cpu_cost = Column(Float, default=0.0)
    memory_cost = Column(Float, default=0.0)
    storage_cost = Column(Float, default=0.0)
    pv_cost = Column(Float, default=0.0)

    # Resource allocation and usage
    cpu_allocation = Column(Float, default=0.0)
    memory_allocation = Column(Float, default=0.0)
    cpu_usage = Column(Float, default=0.0)
    memory_usage = Column(Float, default=0.0)

    # Efficiency metrics
    cpu_efficiency = Column(Float, default=0.0)
    memory_efficiency = Column(Float, default=0.0)

    # Additional metadata
    raw_data = Column(JSON)
    argument_hash = Column(String(255), nullable=True)
    query_params = Column(JSON, nullable=True)

    # Relationships
    pod = relationship("Pod", back_populates="pod_metrics")

    # Composite index for time-based queries
    __table_args__ = (Index("idx_pod_time_window", "pod_id", "timestamp", "window"),)


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

    # def drop_tables(self):
    #     """Drop all tables (use with caution!)"""
    #     Base.metadata.drop_all(bind=self.engine)


# Initialize database manager
db_manager = DatabaseManager()
