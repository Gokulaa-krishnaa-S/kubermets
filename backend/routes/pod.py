from flask import Blueprint, jsonify, request
from models.model import PodMetrics, db_manager
from sqlalchemy import desc

pods_bp = Blueprint("pods", __name__, url_prefix="/v1/pods")

@pods_bp.route("/", methods=["GET"])
def get_pod_metrics():
    """
    Get pod metrics with optional filtering
    Query params: namespace, name, window, limit, offset, start_date, end_date
    """
    print("hello")
    session = db_manager.get_session()
    try:
        query = session.query(PodMetrics)

        # Apply filters
        namespace = request.args.get("namespace")
        if namespace:
            query = query.filter(PodMetrics.namespace == namespace)

        name = request.args.get("name")
        if name:
            query = query.filter(PodMetrics.name == name)

        window = request.args.get("window")
        if window:
            query = query.filter(PodMetrics.window == window)

        start_date = request.args.get("start_date")
        if start_date:
            query = query.filter(PodMetrics.start_time >= start_date)

        end_date = request.args.get("end_date")
        if end_date:
            query = query.filter(PodMetrics.end_time <= end_date)

        # Pagination
        limit = int(request.args.get("limit", 100))
        offset = int(request.args.get("offset", 0))

        # Order by start_time desc
        query = query.order_by(desc(PodMetrics.start_time))

        total_count = query.count()
        metrics = query.limit(limit).offset(offset).all()

        result = [metric.__dict__ for metric in metrics]
        for r in result:
            r.pop('_sa_instance_state', None)

        return (
            jsonify({
                "data": result,
                "total_count": total_count,
                "limit": limit,
                "offset": offset,
            }),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
