from flask import Flask, Response, jsonify, request
from flasgger import Swagger
from .clusters import clusters_bp 
from .errors import errors

app = Flask(__name__)
app.register_blueprint(errors)
app.register_blueprint(clusters_bp)
swagger = Swagger(app, template_file='../docs/swagger.yaml')

@app.route("/")
def index():
    return Response("Hello, world!", status=200)


@app.route("/custom", methods=["POST"])
def custom():
    payload = request.get_json()

    if payload.get("say_hello") is True:
        output = jsonify({"message": "Hello!"})
    else:
        output = jsonify({"message": "..."})

    return output


@app.route("/health")
def health():
    return Response("OK", status=200)
