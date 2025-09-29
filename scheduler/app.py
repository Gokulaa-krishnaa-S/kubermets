from flask import Flask, jsonify
from scheduler import schedulerMain
import threading
from melts import melts_bp

app = Flask(__name__)
app.register_blueprint(melts_bp)

@app.route("/")
def home():
    return jsonify({"message": "Hello Flask!"})

def start_scheduler():
    schedulerMain()

if __name__ == "__main__":
    # Start the scheduler in a background thread
    scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
    scheduler_thread.start()

    # Start Flask app on localhost:5001
    app.run(debug=True, host="0.0.0.0", port=5001)

# if __name__ == "__main__":
#     start_scheduler()
