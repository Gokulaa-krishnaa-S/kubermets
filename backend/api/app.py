from flask import Flask, Response, jsonify, request
from flasgger import Swagger
from .clusters import clusters_bp
from .errors import errors
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.register_blueprint(errors)
app.register_blueprint(clusters_bp)
swagger = Swagger(app, template_file="../docs/swagger.yaml")


@app.route("/")
def index():
    return Response("Hello, world!", status=200)


@app.route("/health")
def health():
    return Response("OK", status=200)
