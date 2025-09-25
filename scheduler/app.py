from flask import Flask, jsonify
from scheduler import schedulerMain

app = Flask(__name__)

@app.route("/")
def home():
    return jsonify({"message": "Hello Flask!"})

if __name__ == "__main__":
    # Start Flask app on localhost:5000
    schedulerMain()

    app.run(debug=True, host="0.0.0.0", port=5001)

