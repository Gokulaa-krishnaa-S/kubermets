from flask import Blueprint, jsonify, request
from models.model import PodMetrics, db_manager
from sqlalchemy import func
from datetime import datetime, timedelta

pods_bp = Blueprint("pods", __name__, url_prefix="/v1")


@pods_bp.route("/pods", methods=["GET"])
def pod_metrics():
    """
    Fetch pod metrics by cluster_id with optional time window duration
    Params:
      cluster_id (required)
      user_id (required)
      duration: 1h, 6h, 24h, 7d, 30d (default: 24h)
      namespace (optional): filter by namespace
      search (optional): search by pod name
    """
    print("=== Fetching pod metrics ===")
    session = db_manager.get_session()
    try:
        # 1️⃣ Get cluster_id from request
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id")
        print(user_id, "=================user_id=================")
        print(f"Requested cluster_id: {cluster_id}")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400
        # 2️⃣ Get duration (default: 24h)
        duration = request.args.get("duration", "24h")
        # Optional filters
        namespace = request.args.get("namespace")
        search = request.args.get("search")
        # Convert duration into datetime filter
        end_time = datetime.utcnow()
        result = get_pod_metrics(
            session, cluster_id, user_id, duration, namespace, search
        )
        return jsonify(result)

    except Exception as e:
        print(f"Error fetching pod metrics: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@pods_bp.route("/pods/<pod_name>/details", methods=["GET"])
def get_pod_details(pod_name):
    """
    Fetch essential details for a specific pod (streamlined response)
    Params:
      cluster_id (required)
      user_id (required)
      namespace (optional)
      duration: 1h, 6h, 24h, 7d, 30d (default: 7d)

    Returns concise pod summary instead of all time-series data
    """
    print(f"=== Fetching pod details for {pod_name} ===")
    session = db_manager.get_session()
    try:
        # Get parameters
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id")
        print(user_id, "=================user_id=================")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        namespace = request.args.get("namespace")
        duration = request.args.get("duration", "7d")
        domain = request.args.get("domain")

        # Convert duration into datetime filter
        end_time = datetime.utcnow()
        if duration.endswith("h"):
            hours = int(duration[:-1])
            start_time = end_time - timedelta(hours=hours)
        elif duration.endswith("d"):
            days = int(duration[:-1])
            start_time = end_time - timedelta(days=days)
        else:
            return jsonify({"error": "Invalid duration format"}), 400

        # Build aggregated query for pod summary (instead of all records)
        query = session.query(
            PodMetrics.name,
            PodMetrics.namespace,
            PodMetrics.key,
            PodMetrics.domain,
            # Cost totals
            func.sum(PodMetrics.total_cost).label("total_cost"),
            func.sum(PodMetrics.cpu_cost).label("cpu_cost"),
            func.sum(PodMetrics.ram_cost).label("ram_cost"),
            func.sum(PodMetrics.pv_cost).label("pv_cost"),
            func.sum(PodMetrics.gpu_cost).label("gpu_cost"),
            func.sum(PodMetrics.network_cost).label("network_cost"),
            func.sum(PodMetrics.load_balancer_cost).label("load_balancer_cost"),
            func.sum(PodMetrics.external_cost).label("external_cost"),
            func.sum(PodMetrics.shared_cost).label("shared_cost"),
            # Resource averages
            func.avg(PodMetrics.cpu_core_usage_average).label("avg_cpu_usage"),
            func.avg(PodMetrics.cpu_core_request_average).label("avg_cpu_request"),
            func.avg(PodMetrics.ram_byte_usage_average).label("avg_ram_usage_bytes"),
            func.avg(PodMetrics.ram_byte_request_average).label(
                "avg_ram_request_bytes"
            ),
            func.avg(PodMetrics.ram_usage_gb).label("avg_ram_usage_gb"),
            func.avg(PodMetrics.ram_request_gb).label("avg_ram_request_gb"),
            func.avg(PodMetrics.gpu_usage_average).label("avg_gpu_usage"),
            func.avg(PodMetrics.gpu_request_average).label("avg_gpu_request"),
            func.avg(PodMetrics.pv_bytes).label("avg_storage_bytes"),
            # Efficiency metrics
            func.avg(PodMetrics.cpu_efficiency).label("avg_cpu_efficiency"),
            func.avg(PodMetrics.ram_efficiency).label("avg_ram_efficiency"),
            func.avg(PodMetrics.total_efficiency).label("avg_total_efficiency"),
            # Time info
            func.min(PodMetrics.start_time).label("first_seen"),
            func.max(PodMetrics.end_time).label("last_seen"),
            func.count(PodMetrics.id).label("total_records"),
            # Runtime calculation (total hours)
            func.sum(
                func.extract("epoch", PodMetrics.end_time - PodMetrics.start_time)
                / 3600
            ).label("total_runtime_hours"),
            # Flags
            func.bool_or(PodMetrics.is_idle).label("has_idle_periods"),
        ).filter(
            PodMetrics.cluster_id == cluster_id,
            PodMetrics.user_id == user_id,
            PodMetrics.name == pod_name,
            PodMetrics.window_end > start_time,    
            PodMetrics.window_start < end_time,  
        )

        if namespace:
            query = query.filter(PodMetrics.namespace == namespace)

        if domain:
            query = query.filter(PodMetrics.domain == domain)

        # Group by pod identifiers to get single summary
        query = query.group_by(
            PodMetrics.name, PodMetrics.namespace, PodMetrics.key, PodMetrics.domain
        )

        # Execute query
        result = query.first()

        if not result:
            return (
                jsonify(
                    {
                        "error": "Pod not found",
                        "pod_name": pod_name,
                        "cluster_id": cluster_id,
                        "user_id": user_id,
                        "namespace": namespace,
                        "time_range": f"{start_time.isoformat()} to {end_time.isoformat()}",
                    }
                ),
                404,
            )

        # Calculate cost per hour
        cost_per_hour = float(result.total_cost or 0) / max(
            float(result.total_runtime_hours or 1), 0.01
        )

        # Format streamlined response
        pod_summary = {
            "podInfo": {
                "name": result.name,
                "namespace": result.namespace,
                "domain": result.domain,
                "key": result.key,
            },
            "timeInfo": {
                "firstSeen": (
                    result.first_seen.isoformat() if result.first_seen else None
                ),
                "lastSeen": result.last_seen.isoformat() if result.last_seen else None,
                "totalRuntimeHours": round(float(result.total_runtime_hours or 0), 2),
                "totalRecords": int(result.total_records or 0),
                "queryRange": {
                    "start": start_time.isoformat(),
                    "end": end_time.isoformat(),
                    "duration": duration,
                },
            },
            "costSummary": {
                "totalCost": round(float(result.total_cost or 0), 2),
                "breakdown": {
                    "cpu": round(float(result.cpu_cost or 0), 2),
                    "memory": round(float(result.ram_cost or 0), 2),
                    "storage": round(float(result.pv_cost or 0), 2),
                    "gpu": round(float(result.gpu_cost or 0), 2),
                    "network": round(float(result.network_cost or 0), 2),
                    "loadBalancer": round(float(result.load_balancer_cost or 0), 2),
                    "external": round(float(result.external_cost or 0), 2),
                    "shared": round(float(result.shared_cost or 0), 2),
                },
                "avgCostPerHour": round(cost_per_hour, 2),
            },
            "resourceUsage": {
                "cpu": {
                    "averageUsage": round(float(result.avg_cpu_usage or 0), 3),
                    "averageRequest": round(float(result.avg_cpu_request or 0), 3),
                    "efficiency": round(float(result.avg_cpu_efficiency or 0), 1),
                },
                "memory": {
                    "averageUsageGB": round(float(result.avg_ram_usage_gb or 0), 2),
                    "averageRequestGB": round(float(result.avg_ram_request_gb or 0), 2),
                    "efficiency": round(float(result.avg_ram_efficiency or 0), 1),
                },
                "gpu": {
                    "averageUsage": round(float(result.avg_gpu_usage or 0), 3),
                    "averageRequest": round(float(result.avg_gpu_request or 0), 3),
                },
                "storage": {
                    "averageBytes": int(result.avg_storage_bytes or 0),
                    "averageGB": round(
                        float(result.avg_storage_bytes or 0) / (1024**3), 2
                    ),
                },
            },
            "performance": {
                "totalEfficiency": round(float(result.avg_total_efficiency or 0), 1),
                "hasIdlePeriods": bool(result.has_idle_periods),
                "longestRuntime": round(float(result.total_runtime_hours or 0), 2),
            },
        }

        return (
            jsonify(
                {
                    "pod_name": pod_name,
                    "cluster_id": cluster_id,
                    "user_id": user_id,
                    "data": pod_summary,
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error fetching pod details: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# Endpoint: Get active pod counts for a cluster
@pods_bp.route("/pods/getactivepodcounts", methods=["POST"])
def get_active_pod_counts():
    """
    Returns the count of active pods for a given cluster_id (POST body: {"cluster_id": ...})
    Uses PodMetrics.key: if "__idle__" then idle, else active.
    Response: {"active_count": <int>}
    """
    data = request.get_json(force=True)
    cluster_id = data.get("cluster_id")
    if not cluster_id:
        return jsonify({"error": "cluster_id is required"}), 400
    session = db_manager.get_session()
    try:
        # Query all pods for the cluster_id
        pod_keys = (
            session.query(PodMetrics.key)
            .filter(PodMetrics.cluster_id == cluster_id)
            .all()
        )
        # Count active pods (key != "__idle__")
        active_count = sum(1 for (key,) in pod_keys if key != "__idle__")
        idle_count = sum(1 for (key,) in pod_keys if key == "__idle__")
        return jsonify({"active_count": active_count, "idle_count": idle_count})
    except Exception as e:
        print(f"Error in get_active_pod_counts: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@pods_bp.route("/pods/<pod_name>/timeline", methods=["GET"])
def get_pod_timeline(pod_name):
    """
    Optional: Get detailed timeline data for a pod if needed
    Returns time-series data for charts/graphs
    """
    print(f"=== Fetching pod timeline for {pod_name} ===")
    session = db_manager.get_session()
    try:
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id")
        print(user_id, "=================user_id=================")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        namespace = request.args.get("namespace")
        duration = request.args.get("duration", "7d")

        # Convert duration
        end_time = datetime.utcnow()
        if duration.endswith("h"):
            hours = int(duration[:-1])
            start_time = end_time - timedelta(hours=hours)
        elif duration.endswith("d"):
            days = int(duration[:-1])
            start_time = end_time - timedelta(days=days)
        else:
            return jsonify({"error": "Invalid duration format"}), 400

        # Get time-series data
        query = (
            session.query(
                PodMetrics.start_time,
                PodMetrics.end_time,
                PodMetrics.total_cost,
                PodMetrics.cpu_core_usage_average,
                PodMetrics.ram_usage_gb,
                PodMetrics.cpu_efficiency,
                PodMetrics.ram_efficiency,
            )
            .filter(
                PodMetrics.cluster_id == cluster_id,
                PodMetrics.user_id == user_id,
                PodMetrics.name == pod_name,
                PodMetrics.timestamp >= start_time,
                PodMetrics.timestamp <= end_time,
            )
            .order_by(PodMetrics.timestamp)
        )

        if namespace:
            query = query.filter(PodMetrics.namespace == namespace)

        results = query.all()

        if not results:
            return jsonify({"error": "No timeline data found"}), 404

        # Format timeline data
        timeline = []
        for row in results:
            timeline.append(
                {
                    "timestamp": row.start_time.isoformat() if row.start_time else None,
                    "endTime": row.end_time.isoformat() if row.end_time else None,
                    "cost": float(row.total_cost or 0),
                    "cpuUsage": float(row.cpu_core_usage_average or 0),
                    "memoryUsageGB": float(row.ram_usage_gb or 0),
                    "cpuEfficiency": float(row.cpu_efficiency or 0),
                    "memoryEfficiency": float(row.ram_efficiency or 0),
                }
            )

        return (
            jsonify(
                {
                    "pod_name": pod_name,
                    "cluster_id": cluster_id,
                    "user_id": user_id,
                    "timeline": timeline,
                    "total_points": len(timeline),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error fetching pod timeline: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


def get_pod_details(pod_name):
    """
    Fetch detailed metrics for a specific pod
    Params:
      cluster_id (required)
        user_id (required)
      namespace (optional)
      duration: 1h, 6h, 24h, 7d, 30d (default: 7d)
    """
    print(f"=== Fetching pod details for {pod_name} ===")
    session = db_manager.get_session()
    try:
        # Get parameters
        cluster_id = request.args.get("cluster_id")
        user_id = request.args.get("user_id")
        print(user_id, "=================user_id=================")
        if not cluster_id:
            return jsonify({"error": "cluster_id is required"}), 400

        namespace = request.args.get("namespace")
        duration = request.args.get("duration", "7d")
        domain = request.args.get("domain")

        # Convert duration into datetime filter
        end_time = datetime.utcnow()
        if duration.endswith("h"):
            hours = int(duration[:-1])
            start_time = end_time - timedelta(hours=hours)
        elif duration.endswith("d"):
            days = int(duration[:-1])
            start_time = end_time - timedelta(days=days)
        else:
            return jsonify({"error": "Invalid duration format"}), 400

        # Build query for specific pod - Use same approach as main endpoint
        query = session.query(PodMetrics).filter(
            PodMetrics.cluster_id == cluster_id,  # String comparison like nodes API
            PodMetrics.user_id == user_id,
            PodMetrics.name == pod_name,
            PodMetrics.start_time >= start_time,
            PodMetrics.start_time <= end_time,
        )

        if namespace:
            query = query.filter(PodMetrics.namespace == namespace)

        if domain:
            query = query.filter(PodMetrics.domain == domain)

        # Execute query
        results = query.all()

        if not results:
            return (
                jsonify(
                    {
                        "error": "Pod not found",
                        "debug": {
                            "pod_name": pod_name,
                            "cluster_id": cluster_id,
                            "user_id": user_id,
                            "namespace": namespace,
                            "time_range": f"{start_time} to {end_time}",
                        },
                    }
                ),
                404,
            )

        # Format detailed response
        pod_details = []
        for pod in results:
            detail = {
                "id": pod.key,
                "name": pod.name,
                "namespace": pod.namespace,
                "window": pod.window,
                "startTime": pod.start_time.isoformat() if pod.start_time else None,
                "endTime": pod.end_time.isoformat() if pod.end_time else None,
                "costs": {
                    "total": float(pod.total_cost or 0),
                    "cpu": float(pod.cpu_cost or 0),
                    "ram": float(pod.ram_cost or 0),
                    "pv": float(pod.pv_cost or 0),
                    "gpu": float(pod.gpu_cost or 0),
                    "network": float(pod.network_cost or 0),
                    "loadBalancer": float(pod.load_balancer_cost or 0),
                    "external": float(pod.external_cost or 0),
                    "shared": float(pod.shared_cost or 0),
                },
                "resources": {
                    "cpu": {
                        "usage": float(pod.cpu_core_usage_average or 0),
                        "request": float(pod.cpu_core_request_average or 0),
                        "efficiency": float(pod.cpu_efficiency or 0),
                    },
                    "memory": {
                        "usageBytes": float(pod.ram_byte_usage_average or 0),
                        "requestBytes": float(pod.ram_byte_request_average or 0),
                        "usageGB": float(pod.ram_usage_gb or 0),
                        "requestGB": float(pod.ram_request_gb or 0),
                        "efficiency": float(pod.ram_efficiency or 0),
                    },
                    "gpu": {
                        "usage": float(pod.gpu_usage_average or 0),
                        "request": float(pod.gpu_request_average or 0),
                    },
                    "storage": {"bytes": float(pod.pv_bytes or 0)},
                },
                "efficiency": {
                    "total": float(pod.total_efficiency or 0),
                    "cpu": float(pod.cpu_efficiency or 0),
                    "memory": float(pod.ram_efficiency or 0),
                },
                "flags": {"isIdle": bool(pod.is_idle)},
                "metadata": {
                    "domain": pod.domain,
                    "createdAt": pod.created_at.isoformat() if pod.created_at else None,
                    "updatedAt": pod.updated_at.isoformat() if pod.updated_at else None,
                },
            }
            pod_details.append(detail)

        return (
            jsonify(
                {
                    "pod_name": pod_name,
                    "cluster_id": cluster_id,
                    "user_id": user_id,
                    "namespace": namespace,
                    "domain": domain,
                    "duration": duration,
                    "data": pod_details,
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "total_records": len(pod_details),
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error fetching pod details: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# 1️⃣ Parse duration utility
def parse_duration(duration: str, end_time: datetime):
    if duration.endswith("h"):
        hours = int(duration[:-1])
        start_time = end_time - timedelta(hours=hours)
    elif duration.endswith("d"):
        days = int(duration[:-1])
        start_time = end_time - timedelta(days=days)
    elif duration.endswith("m"):  # months → approx 30 days each
        months = int(duration[:-1])
        start_time = end_time - timedelta(days=months * 30)
    else:
        raise ValueError("Invalid duration format")
    return start_time, end_time


# 2️⃣ Build pod query
def build_pod_query(
    session, cluster_id, user_id, start_time, end_time, namespace=None, search=None
):
    query = session.query(
        PodMetrics.name,
        PodMetrics.namespace,
        PodMetrics.key,
        func.sum(PodMetrics.total_cost).label("total_cost"),
        func.sum(PodMetrics.cpu_cost).label("cpu_cost"),
        func.sum(PodMetrics.ram_cost).label("ram_cost"),
        func.sum(PodMetrics.pv_cost).label("pv_cost"),
        func.sum(PodMetrics.gpu_cost).label("gpu_cost"),
        func.sum(PodMetrics.network_cost).label("network_cost"),
        func.sum(PodMetrics.load_balancer_cost).label("load_balancer_cost"),
        func.sum(PodMetrics.external_cost).label("external_cost"),
        func.sum(PodMetrics.shared_cost).label("shared_cost"),
        func.avg(PodMetrics.cpu_core_usage_average).label("cpu_core_usage_average"),
        func.avg(PodMetrics.cpu_core_request_average).label("cpu_core_request_average"),
        func.avg(PodMetrics.ram_byte_usage_average).label("ram_byte_usage_average"),
        func.avg(PodMetrics.ram_byte_request_average).label("ram_byte_request_average"),
        func.avg(PodMetrics.gpu_usage_average).label("gpu_usage_average"),
        func.avg(PodMetrics.gpu_request_average).label("gpu_request_average"),
        func.avg(PodMetrics.pv_bytes).label("pv_bytes"),
        func.avg(PodMetrics.total_efficiency).label("total_efficiency"),
        func.avg(PodMetrics.cpu_efficiency).label("cpu_efficiency"),
        func.avg(PodMetrics.ram_efficiency).label("ram_efficiency"),
        func.avg(PodMetrics.ram_usage_gb).label("ram_usage_gb"),
        func.avg(PodMetrics.ram_request_gb).label("ram_request_gb"),
        func.bool_or(PodMetrics.is_idle).label("is_idle"),
        func.min(PodMetrics.start_time).label("start_time"),
        func.max(PodMetrics.end_time).label("end_time"),
        func.min(PodMetrics.created_at).label("created_at"),
        func.max(PodMetrics.updated_at).label("updated_at"),
        PodMetrics.domain.label("domain"),
    ).filter(
        PodMetrics.cluster_id == cluster_id,
        PodMetrics.user_id == user_id,
        PodMetrics.start_time >= start_time,
        PodMetrics.end_time <= end_time,
    )

    if namespace:
        query = query.filter(PodMetrics.namespace == namespace)

    if search:
        query = query.filter(PodMetrics.name.ilike(f"%{search}%"))

    return query.group_by(
        PodMetrics.name, PodMetrics.namespace, PodMetrics.key, PodMetrics.domain
    )


# 3️⃣ Format row results
def format_pod_results(results):
    data = []
    for row in results:
        data.append(
            {
                "id": row.key,
                "name": row.name,
                "namespace": row.namespace,
                "domain": row.domain,
                "totalCost": float(row.total_cost or 0),
                "cpuCost": float(row.cpu_cost or 0),
                "ramCost": float(row.ram_cost or 0),
                "pvCost": float(row.pv_cost or 0),
                "gpuCost": float(row.gpu_cost or 0),
                "networkCost": float(row.network_cost or 0),
                "loadBalancerCost": float(row.load_balancer_cost or 0),
                "externalCost": float(row.external_cost or 0),
                "sharedCost": float(row.shared_cost or 0),
                "cpuCoreUsageAverage": float(row.cpu_core_usage_average or 0),
                "cpuCoreRequestAverage": float(row.cpu_core_request_average or 0),
                "ramByteUsageAverage": float(row.ram_byte_usage_average or 0),
                "ramByteRequestAverage": float(row.ram_byte_request_average or 0),
                "gpuUsageAverage": float(row.gpu_usage_average or 0),
                "gpuRequestAverage": float(row.gpu_request_average or 0),
                "pvBytes": float(row.pv_bytes or 0),
                "totalEfficiency": float(row.total_efficiency or 0),
                "cpuEfficiency": float(row.cpu_efficiency or 0),
                "ramEfficiency": float(row.ram_efficiency or 0),
                "ramUsageGB": float(row.ram_usage_gb or 0),
                "ramRequestGB": float(row.ram_request_gb or 0),
                "isIdle": bool(row.is_idle),
                "startTime": row.start_time.isoformat() if row.start_time else None,
                "endTime": row.end_time.isoformat() if row.end_time else None,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
                "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
            }
        )
    return data


#  Main reusable function
def get_pod_metrics(
    session, cluster_id, user_id, duration, namespace=None, search=None
):
    try:
        end_time = datetime.utcnow()
        start_time, end_time = parse_duration(duration, end_time)

        total_count = (
            session.query(func.count(PodMetrics.id))
            .filter(PodMetrics.cluster_id == cluster_id)
            .scalar()
        )

        if total_count == 0:
            existing_cluster_ids = session.query(
                func.distinct(PodMetrics.cluster_id)
            ).all()
            return {
                "cluster_id": cluster_id,
                "user_id": user_id,
                "duration": duration,
                "namespace": namespace,
                "search": search,
                "data": [],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "total_count": 0,
                "debug": {
                    "message": "No data found for this cluster_id",
                    "available_cluster_ids": [row[0] for row in existing_cluster_ids],
                },
            }

        query = build_pod_query(
            session, cluster_id, user_id, start_time, end_time, namespace, search
        )
        results = query.all()
        data = format_pod_results(results)

        return {
            "cluster_id": cluster_id,
            "user_id": user_id,
            "duration": duration,
            "namespace": namespace,
            "search": search,
            "data": data,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "total_count": len(data),
        }
    except ValueError as e:
        return {"error": str(e)}


# Chart data retriver
def get_idle_active_pod_counts(pod_data):
    active_count = sum(1 for pod in pod_data if not pod.get("isIdle", False))
    idle_count = sum(1 for pod in pod_data if pod.get("isIdle", False))
    return active_count, idle_count
