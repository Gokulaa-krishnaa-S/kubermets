# clusters/routes.py

from flask import Blueprint, jsonify
from .controllers import get_cluster_status, get_node_info , summaryApi


clusters_bp = Blueprint('clusters', __name__, url_prefix='/api/v1')

@clusters_bp.route('/clusters/status', methods=['GET'])
def cluster_status():
    return jsonify(get_cluster_status())



@clusters_bp.route('/all', methods=['GET'])
def summary():
    return jsonify(summaryApi())

@clusters_bp.route('/clusters/nodes', methods=['GET'])
def node_info():
    return jsonify(get_node_info())
