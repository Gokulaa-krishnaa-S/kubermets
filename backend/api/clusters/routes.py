# clusters/routes.py

from flask import Blueprint, jsonify, Response
from .controllers import get_cluster_status, get_node_info, summaryApi, getPodDetails


clusters_bp = Blueprint("clusters", __name__, url_prefix="/v1")


@clusters_bp.route("/")
def index():
    return Response("Hello, world!", status=200)


@clusters_bp.route("/health")
def health():
    return Response("OK", status=200)


@clusters_bp.route("/clusters/status", methods=["GET"])
def cluster_status():
    return jsonify(get_cluster_status())


@clusters_bp.route("/all", methods=["GET"])
def summary():
    return jsonify(summaryApi())


@clusters_bp.route("/get_pod_details", methods=["GET"])
def getPodDetail():
    return jsonify(getPodDetails())


@clusters_bp.route("/clusters/nodes", methods=["GET"])
def node_info():
    return jsonify(get_node_info())
