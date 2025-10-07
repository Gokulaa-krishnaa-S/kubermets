from flask import Flask, jsonify
from schedulerFiles.scheduler import schedulerMain
import threading
import os
from routes.meltsroutes import melts_bp

app = Flask(__name__)
app.register_blueprint(melts_bp)

@app.route("/")
def home():
    return jsonify({"message": "Hello Flask!"})

def start_scheduler():
    schedulerMain()

if __name__ == "__main__":
    # Prevent double thread start due to Flask reloader
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
        scheduler_thread.start()

    # Run Flask normally
    app.run(debug=True, host="0.0.0.0", port=5001)
