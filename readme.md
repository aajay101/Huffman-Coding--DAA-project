
# Huffman Coding Workstation

Flask application for visualizing Huffman coding, stepping through the algorithm, and compressing text files with diagnostic metrics.

## Routes

- `/` - scrollytelling Huffman visualization
- `/interactive` - interactive Huffman algorithm debugger
- `/text_compressor` - file compression workstation

## Local Development

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/`.

## Production

The app is structured for:

```bash
gunicorn app:app
```

## Docker

```bash
docker build -t huffman-workstation .
docker run -p 8000:8000 huffman-workstation
```
