# clusters/routes.py

from flask import Blueprint, jsonify
from .controllers import get_cluster_status, get_node_info


clusters_bp = Blueprint('clusters', __name__, url_prefix='/clusters')

@clusters_bp.route('/status', methods=['GET'])
def cluster_status():
    return jsonify(get_cluster_status())

@clusters_bp.route('/nodes', methods=['GET'])
def node_info():
    return jsonify(get_node_info())
