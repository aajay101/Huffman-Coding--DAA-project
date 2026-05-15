from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

try:
    from .huffman_engine import encode_with_trace
except ImportError:
    from huffman_engine import encode_with_trace


BASE_DIR = Path(__file__).resolve().parent.parent

app = Flask(__name__)


@app.route("/")
@app.route("/index.html")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/interactive")
@app.route("/interactive.html")
def interactive():
    return send_from_directory(BASE_DIR, "interactive.html")


@app.route("/css/<path:filename>")
def css(filename):
    return send_from_directory(BASE_DIR / "css", filename)


@app.route("/js/<path:filename>")
def js(filename):
    return send_from_directory(BASE_DIR / "js", filename)


@app.route("/img/<path:filename>")
def img(filename):
    return send_from_directory(BASE_DIR / "img", filename)


@app.route("/encode", methods=["POST"])
def encode():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")

    if not isinstance(text, str):
        return jsonify({"error": "Input text must be a string."}), 400

    text = text.rstrip("\r")
    if text == "":
        return jsonify({"error": "Input text must not be empty."}), 400

    return jsonify(encode_with_trace(text))


if __name__ == "__main__":
    app.run(debug=True)
