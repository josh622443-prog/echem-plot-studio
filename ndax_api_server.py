#!/usr/bin/env python3
"""Local HTTP bridge between Echem Plot Studio and NEWARE .ndax files."""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import json, math, os, subprocess, sys, tempfile, threading
from ndax_reader import check_dependencies
from origin_export import validate as validate_origin_payload

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "Echem_Plot_Studio_v1.26.0.html"
READER = ROOT / 'ndax_reader.py'
MAX_UPLOAD = 2 * 1024 * 1024 * 1024
ORIGIN_EXPORTER = ROOT / 'origin_export.py'
ORIGIN_LOCK = threading.Lock()


def origin_status():
    run = subprocess.run([sys.executable, str(ORIGIN_EXPORTER), '--check'], cwd=str(ROOT),
                         capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
    if run.returncode:
        return {'available': False, 'error': (run.stderr or run.stdout).strip()[-4000:]}
    return {'available': True}

class Handler(BaseHTTPRequestHandler):
    server_version = "EchemNdaxAPI/1.0"

    def _send(self, code, body, content_type="application/json; charset=utf-8"):
        if isinstance(body, str): body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/origin/status':
            try:
                return self._send(200, json.dumps(origin_status()))
            except Exception as error:
                return self._send(503, json.dumps({'available': False, 'error': str(error)}))
        if path in ("/", "/index.html"):
            return self._send(200, HTML.read_bytes(), "text/html; charset=utf-8")
        if path in ("/health", "/api/status"):
            try:
                dependencies = check_dependencies()
                ok = HTML.exists() and READER.exists()
                error = None
            except ImportError as exc:
                dependencies, ok, error = {}, False, str(exc)
            return self._send(200 if ok else 503, json.dumps({"ok": ok, "service": "ndax-api", "version": "1.26.0", "root": str(ROOT), "reader": "newarenda-python", "dependencies": dependencies, "error": error}))
        self._send(404, json.dumps({"error": "Not found"}))

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/origin/export':
            return self.export_origin()
        if parsed.path != "/api/ndax":
            return self._send(404, json.dumps({"error": "Not found"}))
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_UPLOAD:
                return self._send(413, json.dumps({"error": "Invalid or oversized upload"}))
            original = self.headers.get("X-Filename", "uploaded.ndax")
            original = Path(original).name
            if not original.lower().endswith(".ndax"):
                return self._send(415, json.dumps({"error": "Expected an .ndax file"}))
            mass = parse_qs(parsed.query).get("mass_g", ["0.04563"])[0]
            if not math.isfinite(float(mass)) or float(mass) <= 0:
                raise ValueError("mass_g must be finite and positive")
            with tempfile.TemporaryDirectory(prefix="echem-ndax-") as td:
                src, out = Path(td) / original, Path(td) / "result.json"
                with src.open("wb") as f:
                    remaining = length
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk: raise IOError("Upload ended early")
                        f.write(chunk); remaining -= len(chunk)
                env = os.environ.copy(); env['PYTHONUTF8'] = '1'
                run = subprocess.run([sys.executable, str(READER), str(src), str(out), '--mass-g', mass],
                                     cwd=str(ROOT), env=env, capture_output=True,
                                     text=True, encoding='utf-8', errors='replace', timeout=1800)
                if run.returncode or not out.exists():
                    msg = (run.stderr or run.stdout or "Python NDAX parsing failed").strip()
                    return self._send(422, json.dumps({"error": msg[-4000:]}))
                return self._send(200, out.read_bytes())
        except ValueError as exc:
            self._send(400, json.dumps({"error": str(exc)}))
        except Exception as exc:
            self._send(500, json.dumps({"error": str(exc)}))

    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args), flush=True)

    def export_origin(self):
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self._send(415, json.dumps({'error': 'Expected JSON export data.'}))
        request_origin = self.headers.get('Origin')
        allowed = {'http://127.0.0.1:' + str(self.server.server_port), 'http://localhost:' + str(self.server.server_port)}
        if request_origin and request_origin not in allowed:
            return self._send(403, json.dumps({'error': 'Use the local Echem page to export.'}))
        if not ORIGIN_LOCK.acquire(blocking=False):
            return self._send(409, json.dumps({'error': 'Another Origin export is in progress. Please wait.'}))
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 128 * 1024 * 1024:
                return self._send(413, json.dumps({'error': 'Origin export data must be between 1 byte and 128 MiB.'}))
            content = self.rfile.read(length)
            payload = json.loads(content)
            validate_origin_payload(payload)
            status = origin_status()
            if not status['available']:
                return self._send(503, json.dumps({'error': status['error']}))
            with tempfile.TemporaryDirectory(prefix='echem-origin-') as directory:
                source, output = Path(directory) / 'data.json', Path(directory) / 'export.opju'
                source.write_bytes(content)
                run = subprocess.run([sys.executable, str(ORIGIN_EXPORTER), str(source), str(output)],
                                     cwd=str(ROOT), capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=300)
                if run.returncode or not output.is_file() or output.stat().st_size == 0:
                    return self._send(422, json.dumps({'error': (run.stderr or run.stdout or 'Origin did not save a project.').strip()[-4000:]}))
                return self._send(200, output.read_bytes(), 'application/octet-stream')
        except (ValueError, TypeError, AttributeError) as error:
            self._send(400, json.dumps({'error': str(error)}))
        except Exception as error:
            self._send(500, json.dumps({'error': str(error)}))
        finally:
            ORIGIN_LOCK.release()

if __name__ == "__main__":
    import argparse, webbrowser
    p = argparse.ArgumentParser(description="Echem Plot Studio local NDAX API")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--open", action="store_true")
    args = p.parse_args()
    url = f"http://{args.host}:{args.port}/"
    print(f"Echem Plot Studio: {url}", flush=True)
    if args.open: webbrowser.open(url)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
