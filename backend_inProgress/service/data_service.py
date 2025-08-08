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
from threading import Thread
import hashlib

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
    

    def get_cluster_data(self, window: str = "7d", force_refresh: bool = False, offset: str = "0", limit: str = "2") -> Dict[str, Any]:
        """Get cluster data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            # Create argument hash for caching
            query_params = {
                "window": window,
                "aggregate": "cluster",
                "offset": offset,
                "limit": limit
            }
            argument_hash = hashlib.md5(str(sorted(query_params.items())).encode()).hexdigest()
            
            # Check cache if force_refresh is False
            if not force_refresh:
                cached_record = session.query(ClusterMetric).filter(
                    ClusterMetric.argument_hash == argument_hash
                ).order_by(desc(ClusterMetric.timestamp)).first()
                
                if cached_record and self._is_cache_valid(cached_record.timestamp):
                    logger.info(f"Returning cached cluster data for argument hash: {argument_hash}")
                    return {
                        "status": "success",
                        "data": cached_record.raw_data,
                        "cached": True,
                        "cache_timestamp": cached_record.timestamp.isoformat(),
                        "query_params": cached_record.query_params
                    }
            
            # Try to fetch fresh data from Kubecost API
            try:
                logger.info(f"Fetching fresh cluster data for arguments: {query_params}")
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
                    "filter": "",
                    "offset": offset,
                    "limit": limit
                }
                
                api_data = self._make_kubecost_request("/model/allocation/summary", params)
                print(api_data, "----------CLUSTER API DATA")
                
                # Store the response with argument hash
                self._store_cluster_argument_based_data(session, api_data, argument_hash, query_params, window)
                
                return {
                    "status": "success",
                    "data": api_data,
                    "cached": False,
                    "fetch_timestamp": datetime.utcnow().isoformat(),
                    "query_params": query_params
                }
                
            except Exception as api_error:
                logger.warning(f"Cluster API request failed: {str(api_error)}")
                
                # API failed, try to get fallback data from cache
                fallback_data = self._get_cluster_fallback_cache_data(session)
                
                if fallback_data:
                    logger.info("Returning fallback cached cluster data due to API failure")
                    return {
                        "status": "success", 
                        "data": fallback_data["data"],
                        "cached": True,
                        "api_failed": True,
                        "requested_params": query_params,
                        "returned_params": fallback_data["query_params"],
                        "cache_timestamp": fallback_data["timestamp"]
                    }
                else:
                    # No fallback data available
                    logger.error(f"No fallback cluster data available and API failed: {str(api_error)}")
                    return {"status": "failed", "error": f"API unavailable and no cached cluster data found: {str(api_error)}"}

        except Exception as e:
            logger.error(f"Error getting cluster data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()


    def _store_cluster_argument_based_data(self, session: Session, api_data: Dict[str, Any], 
                                        argument_hash: str, query_params: Dict, window: str):
        """Store cluster API response with argument hash for caching"""
        try:
            # Create a new record for argument-based caching
            cache_record = ClusterMetric(
                cluster_id=None,  # No specific cluster for argument-based cache
                timestamp=datetime.utcnow(),
                window=window,
                raw_data=api_data,
                argument_hash=argument_hash,
                query_params=query_params
            )
            session.add(cache_record)
            session.commit()
            logger.info(f"Stored cluster argument-based cache with hash: {argument_hash}")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error storing cluster argument-based data: {str(e)}")
            raise


    def _get_cluster_fallback_cache_data(self, session: Session) -> Dict[str, Any]:
        """Get the cluster record with maximum window and maximum limit when API fails"""
        try:
            # Get all cached cluster records
            cached_records = session.query(ClusterMetric).filter(
                ClusterMetric.argument_hash.isnot(None),
                ClusterMetric.raw_data.isnot(None),
                ClusterMetric.query_params.isnot(None)
            ).all()
            
            if not cached_records:
                return None
            
            best_record = None
            max_window_days = 0
            max_limit = 0
            
            for record in cached_records:
                try:
                    # Parse query_params to get window and limit
                    if isinstance(record.query_params, str):
                        import json
                        params = json.loads(record.query_params)
                    else:
                        params = record.query_params
                    
                    window = params.get("window", "0d")
                    limit = int(params.get("limit", "0"))
                    
                    # Convert window to days for comparison
                    window_days = self._window_to_days(window)
                    
                    # Find record with maximum window, then maximum limit
                    if (window_days > max_window_days) or (window_days == max_window_days and limit > max_limit):
                        max_window_days = window_days
                        max_limit = limit
                        best_record = record
                        
                except Exception as e:
                    logger.warning(f"Error parsing cluster record query_params: {str(e)}")
                    continue
            
            if best_record:
                return {
                    "data": best_record.raw_data,
                    "timestamp": best_record.timestamp.isoformat(),
                    "query_params": best_record.query_params
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting cluster fallback cache data: {str(e)}")
            return None

    

    # def get_cluster_data(self, window: str = "7d", force_refresh: bool = False ,  offset: str = "0", limit: str = "2") -> Dict[str, Any]:
    #     """Get cluster data from cache or fetch from API"""
    #     session = db_manager.get_session()
    #     try:
    #         if not force_refresh:
    #             cached_metric = session.query(ClusterMetric).filter(
    #             ClusterMetric.window == window
    #         ).order_by(desc(ClusterMetric.timestamp)).first()
    #             print("cached---------------",cached_metric)
    #             if cached_metric and self._is_cache_valid(cached_metric.timestamp):
    #                  logger.info(f"Returning cached cluster data for window: {window}")

    #             def async_refresh():
    #                 bg_session = db_manager.get_session()
    #                 try:
    #                     logger.info(f"[BG] Refreshing cluster data for window: {window}")
    #                     params = {
    #                         "window": window,
    #                         "aggregate": "cluster",
    #                         "accumulate": "true",
    #                         "external": "false",
    #                         "shareCost": "0",
    #                         "shareTenancyCosts": "true",
    #                         "idle": "true",
    #                         "shareIdle": "true",
    #                         "idleByNode": "true",
    #                         "shareLabels": "",
    #                         "shareNamespaces": "",
    #                         "shareSplit": "weighted",
    #                         "filter": ""
    #                     }
    #                     api_data = self._make_kubecost_request("/model/allocation/summary", params)
    #                     self._process_cluster_data(bg_session, api_data, window)
    #                     logger.info(f"[BG] Cluster data refreshed for window: {window}")
    #                 except Exception as e:
    #                     logger.error(f"[BG] Refresh failed: {str(e)}")
    #                 finally:
    #                     bg_session.close()

    #             Thread(target=async_refresh, daemon=True).start()

    #             return {
    #                 "status": "success",
    #                 "data": cached_metric.raw_data,
    #                 "cached": True,
    #                 "cache_timestamp": cached_metric.timestamp.isoformat()
    #             }

       
    #         logger.info(f"Fetching fresh cluster data for window: {window}")
    #         params = {
    #         "window": window,
    #         "aggregate": "cluster",
    #         "accumulate": "true",
    #         "external": "false",
    #         "shareCost": "0",
    #         "shareTenancyCosts": "true",
    #         "idle": "true",
    #         "shareIdle": "true",
    #         "idleByNode": "true",
    #         "shareLabels": "",
    #         "shareNamespaces": "",
    #         "shareSplit": "weighted",
    #         "filter": ""
    #     }
    #         api_data = self._make_kubecost_request("/model/allocation/summary", params)
    #         self._process_cluster_data(session, api_data, window)

    #         return {
    #         "status": "success",
    #         "data": api_data,
    #         "cached": False,
    #         "fetch_timestamp": datetime.utcnow().isoformat()
    #     }

    #     except Exception as e:
    #         logger.error(f"Error getting cluster data: {str(e)}")
    #         return {"status": "failed", "error": str(e)}
    #     finally:
    #         session.close()

    # def get_node_data(self, window: str = "24h", force_refresh: bool = False) -> Dict[str, Any]:
    #     """Get node data from cache or fetch from API"""
    #     session = db_manager.get_session()
    #     try:
    #         # Check cache first
    #         if not force_refresh:
    #             cached_metrics = session.query(NodeMetric).filter(
    #                 NodeMetric.window == window
    #             ).order_by(desc(NodeMetric.timestamp)).limit(10).all()
                
    #             if cached_metrics and self._is_cache_valid(cached_metrics[0].timestamp):
    #                 logger.info(f"Returning cached node data for window: {window}")
    #                 # Aggregate cached data
    #                 aggregated_data = self._aggregate_node_cache_data(cached_metrics)
    #                 return {
    #                     "status": "success",
    #                     "data": aggregated_data,
    #                     "cached": True,
    #                     "cache_timestamp": cached_metrics[0].timestamp.isoformat()
    #                 }
            
    #         # Fetch fresh data from Kubecost API
    #         logger.info(f"Fetching fresh node data for window: {window}")
    #         params = {
    #             "window": window,
    #             "aggregate": "node",
    #             "accumulate": "true",
    #             "chartType": "costovertime",
    #             "costUnit": "cumulative",
    #             "external": "false",
    #             "filter": "",
    #             "idle": "true",
    #             "idleByNode": "false",
    #             "includeSharedCostBreakdown": "true",
    #             "shareCost": "0",
    #             "shareIdle": "false",
    #             "shareLabels": "",
    #             "shareNamespaces": "",
    #             "shareSplit": "weighted",
    #             "shareTenancyCosts": "true"
    #         }
            
    #         api_data = self._make_kubecost_request("/model/allocation/summary", params)
            
    #         # Process and store the data
    #         self._process_node_data(session, api_data, window)
            
    #         return {
    #             "status": "success",
    #             "data": api_data,
    #             "cached": False,
    #             "fetch_timestamp": datetime.utcnow().isoformat()
    #         }
            
    #     except Exception as e:
    #         logger.error(f"Error getting node data: {str(e)}")
    #         return {"status": "failed", "error": str(e)}
    #     finally:
    #         session.close()
    
    import threading

    def get_node_data(self, window: str = "24h", force_refresh: bool = False ,  offset: str = "0", limit: str = "2") -> Dict[str, Any]:
        """Get node data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            print("working node----")
            # Check cache first
            if not force_refresh:
                cached_metrics = session.query(NodeMetric).filter(
                    NodeMetric.window == window
                ).order_by(desc(NodeMetric.timestamp)).limit(10).all()
                
                if cached_metrics and self._is_cache_valid(cached_metrics[0].timestamp):
                    logger.info(f"Returning cached node data for window: {window}")

                    aggregated_data = self._aggregate_node_cache_data(cached_metrics)

                    def async_refresh():
                        try:
                            logger.info(f"Refreshing node data in background for window: {window}")
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
                            self._process_node_data(session, api_data, window)
                        except Exception as e:
                            logger.error(f"Background refresh failed for node data: {str(e)}")

                    Thread(target=async_refresh).start()

                    return {
                        "status": "success",
                        "data": aggregated_data,
                        "cached": True,
                        "cache_timestamp": cached_metrics[0].timestamp.isoformat()
                    }
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
            print(api_data,"----------000000000000))))))))))0")
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

    # def get_pod_data(self, window: str = "7d", aggregate: str = "controller", 
    #                  filter_pods: str = None, force_refresh: bool = False , offset: str = "0", limit: str="2") -> Dict[str, Any]:
    #     """Get pod data from cache or fetch from API"""
    #     session = db_manager.get_session()
    #     try:
    #         # For specific pod filtering, skip cache for now (can be optimized later)
    #         if not filter_pods and not force_refresh:
    #             cached_metrics = session.query(PodMetric).filter(
    #                 PodMetric.window == window
    #             ).order_by(desc(PodMetric.timestamp)).limit(50).all()
                
    #             if cached_metrics and self._is_cache_valid(cached_metrics[0].timestamp):
    #                 logger.info(f"Returning cached pod data for window: {window}")
    #                 aggregated_data = self._aggregate_pod_cache_data(cached_metrics)
    #                 return {
    #                     "status": "success",
    #                     "data": aggregated_data,
    #                     "cached": True,
    #                     "cache_timestamp": cached_metrics[0].timestamp.isoformat()
    #                 }
            
    #         # Fetch fresh data from Kubecost API
    #         logger.info(f"Fetching fresh pod data for window: {window}, aggregate: {aggregate}")
    #         params = {
    #             "window": window,
    #             "accumulate": "true",
    #             "aggregate": aggregate,
    #             "chartType": "costovertime",
    #             "costUnit": "cumulative",
    #             "external": "false",
    #             "filter": "",
    #             "idle": "true",
    #             "idleByNode": "false",
    #             "includeSharedCostBreakdown": "true",
    #             "shareCost": "0",
    #             "shareIdle": "false",
    #             "shareLabels": "",
    #             "shareNamespaces": "",
    #             "shareSplit": "weighted",
    #             "shareTenancyCosts": "true",
    #             "offset": offset,
    #             "limit": limit
    #         }
            
    #         if filter_pods:
    #             params["filterPods"] = filter_pods
            
    #         # Use different endpoint for pod details
    #         endpoint = "/model/allocation" if filter_pods else "/model/allocation/summary"
    #         api_data = self._make_kubecost_request(endpoint, params)
    #         # Process and store the data
    #         self._process_pod_data(session, api_data, window, aggregate)
            
    #         return {
    #             "status": "success",
    #             "data": api_data,
    #             "cached": False,
    #             "fetch_timestamp": datetime.utcnow().isoformat()
    #         }
            
    #     except Exception as e:
    #         logger.error(f"Error getting pod data: {str(e)}")
    #         return {"status": "failed", "error": str(e)}
    #     finally:
    #         session.close()
        
    def get_pod_data(self, window: str = "7d", aggregate: str = "controller", 
                    filter_pods: str = None, force_refresh: bool = False, offset: str = "0", limit: str = "2") -> Dict[str, Any]:
        """Get pod data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            # Create argument hash for caching
            query_params = {
                "window": window,
                "aggregate": aggregate,
                "filter_pods": filter_pods,
                "offset": offset,
                "limit": limit
            }
            argument_hash = hashlib.md5(str(sorted(query_params.items())).encode()).hexdigest()
            
            # Check cache if force_refresh is False
            if not force_refresh:
                cached_record = session.query(PodMetric).filter(
                    PodMetric.argument_hash == argument_hash
                ).order_by(desc(PodMetric.timestamp)).first()
                
                if cached_record and self._is_cache_valid(cached_record.timestamp):
                    logger.info(f"Returning cached data for argument hash: {argument_hash}")
                    return {
                        "status": "success",
                        "data": cached_record.raw_data,
                        "cached": True,
                        "cache_timestamp": cached_record.timestamp.isoformat(),
                        "query_params": cached_record.query_params
                    }
            
            # Try to fetch fresh data from Kubecost API
            try:
                logger.info(f"Fetching fresh data for arguments: {query_params}")
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
                    "offset": offset,
                    "limit": limit
                }
                
                if filter_pods:
                    params["filterPods"] = filter_pods
                
                endpoint = "/model/allocation" if filter_pods else "/model/allocation/summary"
                api_data = self._make_kubecost_request(endpoint, params)
                
                # Store the response with argument hash
                self._store_argument_based_data(session, api_data, argument_hash, query_params, window)
                
                return {
                    "status": "success",
                    "data": api_data,
                    "cached": False,
                    "fetch_timestamp": datetime.utcnow().isoformat(),
                    "query_params": query_params
                }
                
            except Exception as api_error:
                logger.warning(f"API request failed: {str(api_error)}")
                
                # API failed, try to get fallback data from cache
                fallback_data = self._get_fallback_cache_data(session, aggregate, filter_pods)
                
                if fallback_data:
                    logger.info("Returning fallback cached data due to API failure")
                    return {
                        "status": "success", 
                        "data": fallback_data["data"],
                        "cached": True,
                        "api_failed": True,
                        "requested_params": query_params,
                        "returned_params": fallback_data["query_params"],
                        "cache_timestamp": fallback_data["timestamp"]
                    }
                else:
                    # No fallback data available
                    logger.error(f"No fallback data available and API failed: {str(api_error)}")
                    return {"status": "failed", "error": f"API unavailable and no cached data found: {str(api_error)}"}
            
        except Exception as e:
            logger.error(f"Error getting pod data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()


    def _get_fallback_cache_data(self, session: Session, aggregate: str, filter_pods: str = None) -> Dict[str, Any]:
        """Get the record with maximum window and maximum limit when API fails"""
        try:
            # Get all cached records
            cached_records = session.query(PodMetric).filter(
                PodMetric.argument_hash.isnot(None),
                PodMetric.raw_data.isnot(None),
                PodMetric.query_params.isnot(None)
            ).all()
            
            if not cached_records:
                return None
            
            best_record = None
            max_window_days = 0
            max_limit = 0
            
            for record in cached_records:
                try:
                    # Parse query_params to get window and limit
                    if isinstance(record.query_params, str):
                        import json
                        params = json.loads(record.query_params)
                    else:
                        params = record.query_params
                    
                    window = params.get("window", "0d")
                    limit = int(params.get("limit", "0"))
                    
                    # Convert window to days for comparison
                    window_days = self._window_to_days(window)
                    
                    # Find record with maximum window, then maximum limit
                    if (window_days > max_window_days) or (window_days == max_window_days and limit > max_limit):
                        max_window_days = window_days
                        max_limit = limit
                        best_record = record
                        
                except Exception as e:
                    logger.warning(f"Error parsing record query_params: {str(e)}")
                    continue
            
            if best_record:
                return {
                    "data": best_record.raw_data,
                    "timestamp": best_record.timestamp.isoformat(),
                    "query_params": best_record.query_params
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting fallback cache data: {str(e)}")
            return None


    def _window_to_days(self, window: str) -> int:
        """Convert window string to days for comparison"""
        try:
            if window.endswith('d'):
                return int(window[:-1])
            elif window.endswith('h'):
                return int(window[:-1]) // 24
            elif window.endswith('w'):
                return int(window[:-1]) * 7
            elif window.endswith('m'):
                return int(window[:-1]) * 30
            return 0
        except:
            return 0
    # NEW method to store argument-based data
    def _store_argument_based_data(self, session: Session, api_data: Dict[str, Any], 
                                argument_hash: str, query_params: Dict, window: str):
        """Store API response with argument hash for caching"""
        try:
            # Create a new record for argument-based caching
            cache_record = PodMetric(
                pod_id=None,  # No specific pod for argument-based cache
                timestamp=datetime.utcnow(),
                window=window,
                raw_data=api_data,
                argument_hash=argument_hash,
                query_params=query_params
            )
            session.add(cache_record)
            session.commit()
            logger.info(f"Stored argument-based cache with hash: {argument_hash}")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error storing argument-based data: {str(e)}")
            raise


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
                    network_cost = cluster_data.get("networkCost", 0)
                    cpuCoreRequestAverage = cluster_data.get("cpuCoreRequestAverage", 0)
                    cpuCoreUsageAverage = cluster_data.get("cpuCoreUsageAverage", 0)

                    if cpuCoreRequestAverage:
                        cpu_usage_percent = (cpuCoreUsageAverage / cpuCoreRequestAverage) * 100
                    else:
                        cpu_usage_percent = 0

                    ramByteRequestAverage = cluster_data.get("ramByteRequestAverage", 0)
                    ramByteUsageAverage = cluster_data.get("ramByteUsageAverage", 0)

                    if ramByteRequestAverage:
                        memory_usage_percent = (ramByteUsageAverage / ramByteRequestAverage) * 100
                    else:
                        memory_usage_percent = 0

                    print("**************************************************")
                    print("Cluster Metric Data:")
                    print(f"Cluster Name         : {cluster_name}")
                    print(f"Window               : {window}")
                    print(f"Timestamp (UTC)      : {datetime.utcnow()}")
                    print(f"Total Cost           : {total_cost}")
                    print(f"CPU Cost             : {cpu_cost}")
                    print(f"Memory Cost          : {memory_cost}")
                    print(f"Storage Cost         : {storage_cost}")
                    print(f"CPU Usage Percent    : {cpu_usage_percent:.2f}%")
                    print(f"Memory Usage Percent : {memory_usage_percent:.2f}%")
                    print(f"Network Cost         : {network_cost}")
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
                        network_cost = network_cost,
                        cpu_usage_percent=cpu_usage_percent,
                        memory_usage_percent = memory_usage_percent,
                        raw_data=cluster_data
                    )
                    session.add(cluster_metric)

            session.commit()
            logger.info(f"Processed cluster data for {len(sets)} sets")

        except Exception as e:
            session.rollback()
            logger.error(f"Error processing cluster data: {str(e)}")
            raise


    # def _process_node_data(self, session: Session, api_data: Dict[str, Any], window: str):
    #     """Process and store node data"""
    #     try:
    #         print("=====================================")
    #         print(api_data)
    #         print("=====================================")

    #         data = api_data.get('data', {})
    #         sets = data.get('sets', [])

    #         if not sets:
    #             print("No sets found in data")
    #             return

    #         for item in sets:
    #             allocations = item.get('allocations', {})
    #             if not allocations:
    #                 print("No allocations found in set:", item)
    #                 continue

    #             for full_name, node_data in allocations.items():
    #                 # Extract node and cluster name
    #                 parts = full_name.split('/')
    #                 cluster_name = parts[0] if len(parts) > 1 else 'default'
    #                 node_name = parts[1] if len(parts) > 1 else full_name

    #                 print(node_data, "------NODE DATA")
    #                 print(f"Cluster: {cluster_name} | Node: {node_name}")

    #                 cluster = self._upsert_cluster(session, cluster_name)
    #                 node = self._upsert_node(session, cluster, node_name)

    #                 # Extract cost and efficiency metrics
    #                 total_cost = node_data.get('totalCost', 0)
    #                 cpu_cost = node_data.get('cpuCost', 0)
    #                 memory_cost = node_data.get('ramCost', 0)
    #                 cpu_efficiency = node_data.get('cpuEfficiency', 0)
    #                 memory_efficiency = node_data.get('ramEfficiency', 0)

    #                 print("**************************************************")
    #                 print("Node Metric Data:")
    #                 print(f"Node Name            : {node_name}")
    #                 print(f"Cluster Name         : {cluster_name}")
    #                 print(f"Window               : {window}")
    #                 print(f"Timestamp (UTC)      : {datetime.utcnow()}")
    #                 print(f"Total Cost           : {total_cost}")
    #                 print(f"CPU Cost             : {cpu_cost}")
    #                 print(f"Memory Cost          : {memory_cost}")
    #                 print(f"CPU Efficiency       : {cpu_efficiency:.2f}")
    #                 print(f"Memory Efficiency    : {memory_efficiency:.2f}")
    #                 print("**************************************************")

    #                 # Create node metric record
    #                 node_metric = NodeMetric(
    #                     node_id=node.id,
    #                     timestamp=datetime.utcnow(),
    #                     window=window,
    #                     total_cost=total_cost,
    #                     cpu_cost=cpu_cost,
    #                     memory_cost=memory_cost,
    #                     cpu_efficiency=cpu_efficiency,
    #                     memory_efficiency=memory_efficiency,
    #                     raw_data=node_data
    #                 )
    #                 session.add(node_metric)

    #         session.commit()
    #         logger.info(f"Processed node data for {len(sets)} sets")
    #     except Exception as e:
    #         session.rollback()
    #         logger.error(f"Error processing node data: {str(e)}")
    #         raise

    def get_node_data(self, window: str = "24h", force_refresh: bool = False, offset: str = "0", limit: str = "2") -> Dict[str, Any]:
        """Get node data from cache or fetch from API"""
        session = db_manager.get_session()
        try:
            print("working node----")
            
            # Create argument hash for caching
            query_params = {
                "window": window,
                "aggregate": "node",
                "offset": offset,
                "limit": limit
            }
            argument_hash = hashlib.md5(str(sorted(query_params.items())).encode()).hexdigest()
            
            # Check cache if force_refresh is False
            if not force_refresh:
                cached_record = session.query(NodeMetric).filter(
                    NodeMetric.argument_hash == argument_hash
                ).order_by(desc(NodeMetric.timestamp)).first()
                
                if cached_record and self._is_cache_valid(cached_record.timestamp):
                    logger.info(f"Returning cached node data for argument hash: {argument_hash}")
                    return {
                        "status": "success",
                        "data": cached_record.raw_data,
                        "cached": True,
                        "cache_timestamp": cached_record.timestamp.isoformat(),
                        "query_params": cached_record.query_params
                    }
            
            # Try to fetch fresh data from Kubecost API
            try:
                logger.info(f"Fetching fresh node data for arguments: {query_params}")
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
                    "shareTenancyCosts": "true",
                    "offset": offset,
                    "limit": limit
                }
                
                api_data = self._make_kubecost_request("/model/allocation/summary", params)
                print(api_data, "----------NODE API DATA")
                
                # Store the response with argument hash
                self._store_node_argument_based_data(session, api_data, argument_hash, query_params, window)
                
                return {
                    "status": "success",
                    "data": api_data,
                    "cached": False,
                    "fetch_timestamp": datetime.utcnow().isoformat(),
                    "query_params": query_params
                }
                
            except Exception as api_error:
                logger.warning(f"Node API request failed: {str(api_error)}")
                
                # API failed, try to get fallback data from cache
                fallback_data = self._get_node_fallback_cache_data(session)
                
                if fallback_data:
                    logger.info("Returning fallback cached node data due to API failure")
                    return {
                        "status": "success", 
                        "data": fallback_data["data"],
                        "cached": True,
                        "api_failed": True,
                        "requested_params": query_params,
                        "returned_params": fallback_data["query_params"],
                        "cache_timestamp": fallback_data["timestamp"]
                    }
                else:
                    # No fallback data available
                    logger.error(f"No fallback node data available and API failed: {str(api_error)}")
                    return {"status": "failed", "error": f"API unavailable and no cached node data found: {str(api_error)}"}

        except Exception as e:
            logger.error(f"Error getting node data: {str(e)}")
            return {"status": "failed", "error": str(e)}
        finally:
            session.close()


    def _store_node_argument_based_data(self, session: Session, api_data: Dict[str, Any], 
                                    argument_hash: str, query_params: Dict, window: str):
        """Store node API response with argument hash for caching"""
        try:
            # Create a new record for argument-based caching
            cache_record = NodeMetric(
                node_id=None,  # No specific node for argument-based cache
                timestamp=datetime.utcnow(),
                window=window,
                raw_data=api_data,
                argument_hash=argument_hash,
                query_params=query_params
            )
            session.add(cache_record)
            session.commit()
            logger.info(f"Stored node argument-based cache with hash: {argument_hash}")
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error storing node argument-based data: {str(e)}")
            raise


    def _get_node_fallback_cache_data(self, session: Session) -> Dict[str, Any]:
        """Get the node record with maximum window and maximum limit when API fails"""
        try:
            # Get all cached node records
            cached_records = session.query(NodeMetric).filter(
                NodeMetric.argument_hash.isnot(None),
                NodeMetric.raw_data.isnot(None),
                NodeMetric.query_params.isnot(None)
            ).all()
            
            if not cached_records:
                return None
            
            best_record = None
            max_window_days = 0
            max_limit = 0
            
            for record in cached_records:
                try:
                    # Parse query_params to get window and limit
                    if isinstance(record.query_params, str):
                        import json
                        params = json.loads(record.query_params)
                    else:
                        params = record.query_params
                    
                    window = params.get("window", "0d")
                    limit = int(params.get("limit", "0"))
                    
                    # Convert window to days for comparison
                    window_days = self._window_to_days(window)
                    
                    # Find record with maximum window, then maximum limit
                    if (window_days > max_window_days) or (window_days == max_window_days and limit > max_limit):
                        max_window_days = window_days
                        max_limit = limit
                        best_record = record
                        
                except Exception as e:
                    logger.warning(f"Error parsing node record query_params: {str(e)}")
                    continue
            
            if best_record:
                return {
                    "data": best_record.raw_data,
                    "timestamp": best_record.timestamp.isoformat(),
                    "query_params": best_record.query_params
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting node fallback cache data: {str(e)}")
            return None
    def _process_pod_data(self, session: Session, api_data: Dict[str, Any], window: str, aggregate: str):
        """Process and store pod data"""
        try:
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

            
                for pod_name,pod_data in allocations.items():
                    # Extract pod information
                    properties = pod_data
                    pod_name = properties.get('name', 'unknown')
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
                    
                    print(f"""
                    === Pod Metric ===
                    Pod ID            : {pod.id}
                    Timestamp         : {datetime.utcnow()}
                    Window            : {window}
                    Total Cost        : {total_cost}
                    CPU Cost          : {cpu_cost}
                    Memory Cost       : {memory_cost}
                    PV Cost           : {pv_cost}
                    CPU Efficiency    : {cpu_efficiency}
                    Memory Efficiency : {memory_efficiency}
                    Raw Data          : {pod_data}
                    ===================
                    """)


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