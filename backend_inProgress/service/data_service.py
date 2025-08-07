# services/data_service.py
import os
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from models.model import (
    db_manager, Cluster, Node, Pod, ClusterMetric, 
    NodeMetric, PodMetric
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KubecostDataService:
    def __init__(self):
        self.base_domain = os.getenv("domain")
        self.cache_duration_minutes = int(os.getenv("CACHE_DURATION_MINUTES", "5"))
    
    def _make_kubecost_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make request to Kubecost API"""
        query_string = "?" + "&".join(f"{key}={value}" for key, value in params.items())
        full_url = f"{self.base_domain}{endpoint}{query_string}" 
        try:
            response = requests.get(full_url, timeout=30)
            print(response , "=======ACTUAL RESPONSE")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Kubecost API request failed: {str(e)}")
            raise Exception(f"Kubecost API request failed: {str(e)}")
    
    def _is_cache_valid(self, timestamp: datetime) -> bool:
        """Check if cached data is still valid"""
        return datetime.utcnow() - timestamp < timedelta(minutes=self.cache_duration_minutes)
    
    def _upsert_cluster(self, session: Session, cluster_name: str) -> Cluster:
        """Create or update cluster record"""
        cluster = session.query(Cluster).filter(Cluster.name == cluster_name).first()
        if not cluster:
            cluster = Cluster(name=cluster_name, status='active')
            session.add(cluster)
            session.commit()
        return cluster
    
    def _upsert_node(self, session: Session, cluster: Cluster, node_name: str) -> Node:
        """Create or update node record"""
        node = session.query(Node).filter(
            and_(Node.name == node_name, Node.cluster_id == cluster.id)
        ).first()
        if not node:
            node = Node(name=node_name, cluster_id=cluster.id, status='active')
            session.add(node)
            session.commit()
        return node
    
    def _upsert_pod(self, session: Session, pod_name: str, namespace: str, 
                   controller_name: str = None, controller_kind: str = None, 
                   node: Node = None) -> Pod:
        """Create or update pod record"""
        pod = session.query(Pod).filter(
            and_(Pod.name == pod_name, Pod.namespace == namespace)
        ).first()
        if not pod:
            pod = Pod(
                name=pod_name,
                namespace=namespace,
                node_id=node.id if node else None,
                controller_name=controller_name,
                controller_kind=controller_kind,
                status='active'
            )
            session.add(pod)
            session.commit()
        else:
            # Update existing pod
            if node and pod.node_id != node.id:
                pod.node_id = node.id
            if controller_name and pod.controller_name != controller_name:
                pod.controller_name = controller_name
            pod.updated_at = datetime.utcnow()
            session.commit()
        return pod
    
    def get_cluster_data(self, window: str = "7d", force_refresh: bool = False) -> Dict[str, Any]:
        """Get cluster data from cache or fetch from API"""
        session = db_manager.get_session()
        print(session , "session")
        try:
            # Check cache first
            if not force_refresh:
                cached_metric = session.query(ClusterMetric).filter(
                    ClusterMetric.window == window
                ).order_by(desc(ClusterMetric.timestamp)).first()
                
                if cached_metric and self._is_cache_valid(cached_metric.timestamp):
                    logger.info(f"Returning cached cluster data for window: {window}")
                    return {
                        "status": "success",
                        "data": cached_metric.raw_data,
                        "cached": True,
                        "cache_timestamp": cached_metric.timestamp.isoformat()
                    }
            
            # Fetch fresh data from Kubecost API
            logger.info(f"Fetching fresh cluster data for window: {window}")
            params = {
                "window": window,
                "aggregate": "cluster",
                "accumulate": "true",
                "external": "false",
                "shareCost": "0",
                "shareTenancyCosts": "true",
                "idle": "true",
                "shareIdle": "true",
                "idleByNode": "true",
                "shareLabels": "",
                "shareNamespaces": "",
                "shareSplit": "weighted",
                "filter": ""
            }
            
            api_data = self._make_kubecost_request("/model/allocation/summary", params)
            
            # Process and store the data
            self._process_cluster_data(session, api_data, window)
            
            return {
                "status": "success",
                "data": api_data,
                "cached": False,
                "fetch_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting cluster data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()
    
    def get_node_data(self, window: str = "24h", force_refresh: bool = False) -> Dict[str, Any]:
        """Get node data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            # Check cache first
            if not force_refresh:
                cached_metrics = session.query(NodeMetric).filter(
                    NodeMetric.window == window
                ).order_by(desc(NodeMetric.timestamp)).limit(10).all()
                
                if cached_metrics and self._is_cache_valid(cached_metrics[0].timestamp):
                    logger.info(f"Returning cached node data for window: {window}")
                    # Aggregate cached data
                    aggregated_data = self._aggregate_node_cache_data(cached_metrics)
                    return {
                        "status": "success",
                        "data": aggregated_data,
                        "cached": True,
                        "cache_timestamp": cached_metrics[0].timestamp.isoformat()
                    }
            
            # Fetch fresh data from Kubecost API
            logger.info(f"Fetching fresh node data for window: {window}")
            params = {
                "window": window,
                "aggregate": "node",
                "accumulate": "true",
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
                "shareTenancyCosts": "true"
            }
            
            api_data = self._make_kubecost_request("/model/allocation/summary", params)
            
            # Process and store the data
            self._process_node_data(session, api_data, window)
            
            return {
                "status": "success",
                "data": api_data,
                "cached": False,
                "fetch_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting node data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()
    
    def get_pod_data(self, window: str = "7d", aggregate: str = "controller", 
                     filter_pods: str = None, force_refresh: bool = False) -> Dict[str, Any]:
        """Get pod data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            # For specific pod filtering, skip cache for now (can be optimized later)
            if not filter_pods and not force_refresh:
                cached_metrics = session.query(PodMetric).filter(
                    PodMetric.window == window
                ).order_by(desc(PodMetric.timestamp)).limit(50).all()
                
                if cached_metrics and self._is_cache_valid(cached_metrics[0].timestamp):
                    logger.info(f"Returning cached pod data for window: {window}")
                    aggregated_data = self._aggregate_pod_cache_data(cached_metrics)
                    return {
                        "status": "success",
                        "data": aggregated_data,
                        "cached": True,
                        "cache_timestamp": cached_metrics[0].timestamp.isoformat()
                    }
            
            # Fetch fresh data from Kubecost API
            logger.info(f"Fetching fresh pod data for window: {window}, aggregate: {aggregate}")
            params = {
                "window": window,
                "accumulate": "true",
                "aggregate": aggregate,
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
                "offset": "0",
                "limit": "200"
            }
            
            if filter_pods:
                params["filterPods"] = filter_pods
            
            # Use different endpoint for pod details
            endpoint = "/model/allocation" if filter_pods else "/model/allocation/summary"
            api_data = self._make_kubecost_request(endpoint, params)
            
            # Process and store the data
            self._process_pod_data(session, api_data, window, aggregate)
            
            return {
                "status": "success",
                "data": api_data,
                "cached": False,
                "fetch_timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting pod data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()
    def _process_cluster_data(self, session: Session, api_data: Dict[str, Any], window: str):
        """Process and store cluster data"""
        try:
            print("=====================================")
            print(api_data)
            print("=====================================")

            data = api_data.get('data', {})
            sets = data.get('sets', [])

            if not sets:
                print("No sets found in data")
                return

            for item in sets:
                allocations = item.get('allocations', {})
                if not allocations:
                    print("No allocations found in set:", item)
                    continue

                for cluster_name, cluster_data in allocations.items():
                    print(cluster_data, "------CLUSTER DATA")
                    print(cluster_name, "-----NAME")

                    cluster = self._upsert_cluster(session, cluster_name)

                    # Extract cost metrics
                    total_cost = cluster_data.get('totalCost', 0)
                    cpu_cost = cluster_data.get('cpuCost', 0)
                    memory_cost = cluster_data.get('ramCost', 0)
                    storage_cost = cluster_data.get('pvCost', 0)

                    print("**************************************************")
                    print("Cluster Metric Data:")
                    print(f"Cluster Name       : {cluster_name}")
                    print(f"Window             : {window}")
                    print(f"Total Cost         : {total_cost}")
                    print(f"CPU Cost           : {cpu_cost}")
                    print(f"Memory Cost        : {memory_cost}")
                    print(f"Storage Cost       : {storage_cost}")
                    print(f"Timestamp (UTC)    : {datetime.utcnow()}")
                    print("**************************************************")

                    # Create cluster metric record
                    cluster_metric = ClusterMetric(
                        cluster_id=cluster.id,
                        timestamp=datetime.utcnow(),
                        window=window,
                        total_cost=total_cost,
                        cpu_cost=cpu_cost,
                        memory_cost=memory_cost,
                        storage_cost=storage_cost,
                        raw_data=cluster_data
                    )
                    session.add(cluster_metric)

            session.commit()
            logger.info(f"Processed cluster data for {len(sets)} sets")

        except Exception as e:
            session.rollback()
            logger.error(f"Error processing cluster data: {str(e)}")
            raise

    # def _process_cluster_data(self, session: Session, api_data: Dict[str, Any], window: str):
    #     """Process and store cluster data"""
    #     try:
    #         print("=====================================")
    #         print(api_data)
    #         print("=====================================")
    #         data = api_data.get('data', [])
    #         if not data:
    #             return
    #         print(data , "---------------Data")
    #         for cluster_data in data["sets"]:
    #             print(cluster_data , "------CLUSTER DATA")
    #             cluster_name = cluster_data.get('name', 'default')
    #             print(cluster_name , "-----NAME")
    #             cluster = self._upsert_cluster(session, cluster_name)
                
    #             # Extract cost metrics
    #             total_cost = cluster_data.get('totalCost', 0)
    #             cpu_cost = cluster_data.get('cpuCost', 0)
    #             memory_cost = cluster_data.get('ramCost', 0)
    #             storage_cost = cluster_data.get('pvCost', 0)
    #             print("**************************************************")
    #             print("cluster metric Data : ")
             
    #             print("**************************************************")
    #             # Create cluster metric record
    #             cluster_metric = ClusterMetric(
    #                 cluster_id=cluster.id,
    #                 timestamp=datetime.utcnow(),
    #                 window=window,
    #                 total_cost=total_cost,
    #                 cpu_cost=cpu_cost,
    #                 memory_cost=memory_cost,
    #                 storage_cost=storage_cost,
    #                 raw_data=cluster_data
    #             )
    #             session.add(cluster_metric)
            
    #         session.commit()
    #         logger.info(f"Processed cluster data for {len(data)} clusters")
            
    #     except Exception as e:
    #         session.rollback()
    #         logger.error(f"Error processing cluster data: {str(e)}")
    #         raise
            
    def _process_node_data(self, session: Session, api_data: Dict[str, Any], window: str):
        """Process and store node data"""
        try:
            data = api_data.get('data', [])
            if not data:
                return
            
            for node_data in data:
                # Extract node name (usually in format cluster/node)
                full_name = node_data.get('name', '')
                parts = full_name.split('/')
                cluster_name = parts[0] if len(parts) > 1 else 'default'
                node_name = parts[1] if len(parts) > 1 else full_name
                
                cluster = self._upsert_cluster(session, cluster_name)
                node = self._upsert_node(session, cluster, node_name)
                
                # Extract metrics
                total_cost = node_data.get('totalCost', 0)
                cpu_cost = node_data.get('cpuCost', 0)
                memory_cost = node_data.get('ramCost', 0)
                cpu_efficiency = node_data.get('cpuEfficiency', 0)
                memory_efficiency = node_data.get('ramEfficiency', 0)
                
                # Create node metric record
                node_metric = NodeMetric(
                    node_id=node.id,
                    timestamp=datetime.utcnow(),
                    window=window,
                    total_cost=total_cost,
                    cpu_cost=cpu_cost,
                    memory_cost=memory_cost,
                    cpu_efficiency=cpu_efficiency,
                    memory_efficiency=memory_efficiency,
                    raw_data=node_data
                )
                session.add(node_metric)
            
            session.commit()
            logger.info(f"Processed node data for {len(data)} nodes")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error processing node data: {str(e)}")
            raise
    
    def _process_pod_data(self, session: Session, api_data: Dict[str, Any], window: str, aggregate: str):
        """Process and store pod data"""
        try:
            data = api_data.get('data', [])
            if not data:
                return
            
            for pod_data in data:
                # Extract pod information
                properties = pod_data.get('properties', {})
                pod_name = properties.get('pod', 'unknown')
                namespace = properties.get('namespace', 'default')
                controller_name = properties.get('controller', '')
                controller_kind = properties.get('controllerKind', '')
                
                # Create or update pod
                pod = self._upsert_pod(session, pod_name, namespace, controller_name, controller_kind)
                
                # Extract metrics
                total_cost = pod_data.get('totalCost', 0)
                cpu_cost = pod_data.get('cpuCost', 0)
                memory_cost = pod_data.get('ramCost', 0)
                pv_cost = pod_data.get('pvCost', 0)
                cpu_efficiency = pod_data.get('cpuEfficiency', 0)
                memory_efficiency = pod_data.get('ramEfficiency', 0)
                
                # Create pod metric record
                pod_metric = PodMetric(
                    pod_id=pod.id,
                    timestamp=datetime.utcnow(),
                    window=window,
                    total_cost=total_cost,
                    cpu_cost=cpu_cost,
                    memory_cost=memory_cost,
                    pv_cost=pv_cost,
                    cpu_efficiency=cpu_efficiency,
                    memory_efficiency=memory_efficiency,
                    raw_data=pod_data
                )
                session.add(pod_metric)
            
            session.commit()
            logger.info(f"Processed pod data for {len(data)} pods")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error processing pod data: {str(e)}")
            raise
    
    def _aggregate_node_cache_data(self, cached_metrics: List[NodeMetric]) -> Dict[str, Any]:
        """Aggregate cached node metrics for API response format"""
        # This is a simplified aggregation - you might want to enhance this
        total_cost = sum(metric.total_cost for metric in cached_metrics)
        total_cpu_cost = sum(metric.cpu_cost for metric in cached_metrics)
        total_memory_cost = sum(metric.memory_cost for metric in cached_metrics)
        
        return {
            "summary": {
                "totalCost": total_cost,
                "cpuCost": total_cpu_cost,
                "memoryCost": total_memory_cost,
                "nodeCount": len(cached_metrics)
            },
            "data": [metric.raw_data for metric in cached_metrics if metric.raw_data]
        }
    
    def _aggregate_pod_cache_data(self, cached_metrics: List[PodMetric]) -> Dict[str, Any]:
        """Aggregate cached pod metrics for API response format"""
        total_cost = sum(metric.total_cost for metric in cached_metrics)
        active_pods = len(cached_metrics)
        
        return {
            "summary": {
                "totalCost": total_cost,
                "activePods": active_pods
            },
            "data": [metric.raw_data for metric in cached_metrics if metric.raw_data]
        }
    
    # def cleanup_old_data(self, days_to_keep: int = 30):
    #     """Clean up old metrics data"""
    #     session = db_manager.get_session()
    #     try:
    #         cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
    #         # Clean up old metrics
    #         session.query(ClusterMetric).filter(ClusterMetric.timestamp < cutoff_date).delete()
    #         session.query(NodeMetric).filter(NodeMetric.timestamp < cutoff_date).delete()
    #         session.query(PodMetric).filter(PodMetric.timestamp < cutoff_date).delete()
            
    #         session.commit()
    #         logger.info(f"Cleaned up metrics older than {days_to_keep} days")
            
    #     except Exception as e:
    #         session.rollback()
    #         logger.error(f"Error cleaning up old data: {str(e)}")
    #     finally:
    #         session.close()

# Initialize the service
kubecost_service = KubecostDataService()