from flask import Blueprint, jsonify
from controllers.melts import setMelts

melts_bp = Blueprint("melts", __name__, url_prefix="/v1")

@melts_bp.route("/setMeltsData", methods=["POST"])
def set_melts_route():
    """
    Route for handling MELTS data submission.
    """
    result = setMelts()
    return jsonify(result)
