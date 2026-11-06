"""A stand-in for Ollama that speaks its real HTTP API (/api/tags, streaming /api/chat).
Used by the tests because no real model can run in CI. The reply is set by the test."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeOllama:
    def __init__(self, models=("llama3.2:3b", "nomic-embed-text:latest")):
        self.models = list(models)
        self.reply = "Hello."
        self.requests = []
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def do_GET(self):
                if self.path == "/api/tags":
                    body = json.dumps({"models": [{"name": m, "model": m, "size": 1} for m in fake.models]}).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_error(404)

            def do_POST(self):
                req = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                fake.requests.append(req)
                if req["model"] not in fake.models:
                    body = json.dumps({"error": f'model "{req["model"]}" not found, try pulling it first'}).encode()
                    self.send_response(404)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                self.send_response(200)
                self.send_header("Content-Type", "application/x-ndjson")
                self.end_headers()
                words = fake.reply.split(" ")
                for i, w in enumerate(words):
                    piece = w + (" " if i < len(words) - 1 else "")
                    self.wfile.write((json.dumps({"model": req["model"], "message": {"role": "assistant", "content": piece}, "done": False}) + "\n").encode())
                    self.wfile.flush()
                self.wfile.write((json.dumps({"model": req["model"], "message": {"role": "assistant", "content": ""}, "done": True, "done_reason": "stop"}) + "\n").encode())

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), H)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def close(self):
        self.server.shutdown()
        self.server.server_close()
