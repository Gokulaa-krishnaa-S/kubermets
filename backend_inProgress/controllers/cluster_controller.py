# controllers.py - Updated with database layer
import os
import requests
from flask import Flask, request, jsonify
from service.data_service import kubecost_service

def get_cluster_status():
    """Get cluster status with database layer"""
    window = request.args.get("window", "7d")
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    
    try:
        result = kubecost_service.get_cluster_data(window=window, force_refresh=force_refresh)
        return result
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500

def summaryApi():
    """Enhanced summary API with database layer and flexible aggregation"""
    # Get request parameters
    window = request.args.get("window", "7d")
    aggregate = request.args.get("aggregate", "controller")
    chart_type = request.args.get("chartType", "costovertime")
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    
    try:
        # Route to appropriate service method based on aggregation type
        if aggregate == "cluster":
            result = kubecost_service.get_cluster_data(window=window, force_refresh=force_refresh)
        elif aggregate == "node":
            result = kubecost_service.get_node_data(window=window, force_refresh=force_refresh)
        else:  # pod, controller, namespace, etc.
            result = kubecost_service.get_pod_data(
                window=window, 
                aggregate=aggregate,
                force_refresh=force_refresh
            )
        
        return result
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500

def getPodDetails():
    """Get specific pod details with database layer"""
    window = request.args.get("window", "7d")
    filter_pods = request.args.get("filterPods", None)
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    
    try:
        result = kubecost_service.get_pod_data(
            window=window,
            aggregate="pod",
            filter_pods=filter_pods,
            force_refresh=force_refresh
        )
        return result
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500

def get_node_info():
    """Get node information with database layer"""
    window = request.args.get("window", "24h")
    force_refresh = request.args.get("force_refresh", "false").lower() == "true"
    
    try:
        result = kubecost_service.get_node_data(window=window, force_refresh=force_refresh)
        return result
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500

# Additional utility endpoints
def get_cache_status():
    """Get cache status and statistics"""
    from models import db_manager, ClusterMetric, NodeMetric, PodMetric
    from sqlalchemy import func, desc
    
    session = db_manager.get_session()
    try:
        cluster_count = session.query(func.count(ClusterMetric.id)).scalar()
        node_count = session.query(func.count(NodeMetric.id)).scalar()
        pod_count = session.query(func.count(PodMetric.id)).scalar()
        
        # Get latest timestamps
        latest_cluster = session.query(ClusterMetric).order_by(desc(ClusterMetric.timestamp)).first()
        latest_node = session.query(NodeMetric).order_by(desc(NodeMetric.timestamp)).first()
        latest_pod = session.query(PodMetric).order_by(desc(PodMetric.timestamp)).first()
        
        return {
            "status": "success",
            "cache_statistics": {
                "cluster_metrics_count": cluster_count,
                "node_metrics_count": node_count,
                "pod_metrics_count": pod_count,
                "latest_cluster_update": latest_cluster.timestamp.isoformat() if latest_cluster else None,
                "latest_node_update": latest_node.timestamp.isoformat() if latest_node else None,
                "latest_pod_update": latest_pod.timestamp.isoformat() if latest_pod else None
            }
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500
    finally:
        session.close()

def clear_cache():
    """Clear all cached data (admin endpoint)"""
    from models import db_manager, ClusterMetric, NodeMetric, PodMetric
    
    session = db_manager.get_session()
    try:
        # Delete all metrics but keep the entity records (Cluster, Node, Pod)
        session.query(ClusterMetric).delete()
        session.query(NodeMetric).delete()
        session.query(PodMetric).delete()
        session.commit()
        
        return {
            "status": "success",
            "message": "Cache cleared successfully"
        }
    except Exception as e:
        session.rollback()
        return {"status": "failed", "error": str(e)}, 500
    finally:
        session.close()

def force_data_refresh():
    """Force refresh of all data types"""
    try:
        # Refresh cluster data
        cluster_result = kubecost_service.get_cluster_data(force_refresh=True)
        
        # Refresh node data
        node_result = kubecost_service.get_node_data(force_refresh=True)
        
        # Refresh pod data
        pod_result = kubecost_service.get_pod_data(force_refresh=True)
        
        return {
            "status": "success",
            "message": "Data refresh completed",
            "results": {
                "cluster": cluster_result.get("status"),
                "node": node_result.get("status"),
                "pod": pod_result.get("status")
            }
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}, 500