from __future__ import annotations

import base64
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

try:
    from .huffman_engine import compress_and_pack, encode_with_trace, verify_decompression
except ImportError:
    from huffman_engine import compress_and_pack, encode_with_trace, verify_decompression


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


@app.route("/text_compressor")
@app.route("/text_compressor.html")
def text_compressor():
    return send_from_directory(BASE_DIR, "text_compressor.html")


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


@app.route("/compress_file", methods=["POST"])
def compress_file():
    uploaded_file = request.files.get("file")
    if uploaded_file is None:
        return jsonify({"error": "Upload a .txt file before compressing."}), 400

    data = uploaded_file.read()
    if not data:
        return jsonify({"error": "Uploaded file must not be empty."}), 400

    filename = uploaded_file.filename or "input.txt"
    try:
        compression = compress_and_pack(data, filename=filename)
        verification = verify_decompression(compression["packed_file"], data)
        compression["stats"]["verified"] = verification["ok"]

        response = {
            "filename": filename,
            "compressed_filename": f"{Path(filename).stem or 'compressed'}.huff",
            "compressed_file_base64": base64.b64encode(compression["packed_file"]).decode("ascii"),
            "tree_data": compression["tree_data"],
            "metrics": compression["metrics"],
            "stats": compression["stats"],
            "metadata_breakdown": compression["metadata_breakdown"],
            "comparison": compression["comparison"],
            "dynamic_insights": compression["dynamic_insights"],
            "top_10_freqs": compression["top_10_freqs"],
            "visual_tree_data": compression["visual_tree_data"],
            "visual_tree_limit": compression["visual_tree_limit"],
            "frequency_table": compression["frequency_table"],
            "codes": compression["codes"],
            "labels": compression["labels"],
            "bitstream_peek": compression["bitstream_peek"],
            "bitstream_diagnostics": compression["bitstream_diagnostics"],
            "steps": compression["steps"],
            "metadata": compression["metadata"],
            "verification": verification,
        }
        return jsonify(response)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    app.run(debug=True)
