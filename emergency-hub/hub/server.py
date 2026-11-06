"""The local web server: static app + JSON API. Python standard library only."""
from __future__ import annotations

import json
import mimetypes
import re
import shutil
import socket
import sys
import tempfile
import time
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import backup, ollama, rag, search
from .db import CATEGORIES, CATEGORY_NAMES, now
from .ingest import MAX_BYTES, IngestError, delete_document, ingest, pdf_support

STATIC = Path(__file__).resolve().parent.parent / "static"
VERSION = "1.0"


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


_lan_cache = {"at": 0.0, "ips": []}
LOCAL_SUFFIXES = (".local", ".lan", ".home", ".internal", ".localdomain", ".home.arpa")


def host_allowed(host_header: str, extra=()) -> bool:
    """Block DNS-rebinding: only answer to IP addresses, localhost and local network names."""
    host = (host_header or "").strip().lower()
    host = host[1:].split("]")[0] if host.startswith("[") else host.rsplit(":", 1)[0] if host.count(":") == 1 else host
    if not host or host in extra or "." not in host or host.endswith(LOCAL_SUFFIXES):
        return True
    try:
        socket.inet_pton(socket.AF_INET6 if ":" in host else socket.AF_INET, host)
        return True
    except OSError:
        return False


def lan_urls(port: int) -> list:
    if time.time() - _lan_cache["at"] < 60:
        return [f"http://{ip}:{port}" for ip in _lan_cache["ips"]]
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # sends nothing; just picks the LAN interface
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        ips.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    _lan_cache.update(at=time.time(), ips=sorted(ip for ip in ips if not ip.startswith("127.")))
    return [f"http://{ip}:{port}" for ip in _lan_cache["ips"]]


class App:
    def __init__(self, store, ollama_url="http://127.0.0.1:11434", model=None, port=8080, allowed_hosts=()):
        self.store, self.ollama_url, self.cli_model, self.port = store, ollama_url.rstrip("/"), model, port
        self.allowed_hosts = {h.strip().lower() for h in allowed_hosts if h.strip()}

    def wanted_model(self):
        return self.store.get_setting("model") or self.cli_model

    def model_status(self):
        return ollama.status(self.ollama_url, self.wanted_model())


def guide_out(row, docs: set) -> dict:
    g = dict(row)
    g["items"] = json.loads(g["items"] or "[]")
    g["sources"] = json.loads(g["sources"] or "[]")
    for s in g["sources"]:
        s["missing"] = s.get("doc_id") not in docs
    return g


def clean_items(items) -> list:
    out = []
    for it in items or []:
        if isinstance(it, str):
            it = {"text": it, "done": False}
        if isinstance(it, dict) and str(it.get("text", "")).strip():
            out.append({"text": str(it["text"]).strip()[:500], "done": bool(it.get("done"))})
    return out[:300]


def clean_sources(sources) -> list:
    out = []
    for s in sources or []:
        if isinstance(s, dict) and isinstance(s.get("doc_id"), int):
            out.append({k: s.get(k) for k in ("n", "doc_id", "filename", "page", "page_label", "section", "where")})
    return out[:50]


def make_handler(app: App):
    store = app.store

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "EmergencyHub/" + VERSION

        def log_message(self, fmt, *args):
            pass  # quiet; errors are printed in handle_route

        # ---------- plumbing ----------
        def send_json(self, obj, status=200):
            data = json.dumps(obj).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            if status >= 400:  # the request body may be unread; don't reuse this connection
                self.send_header("Connection", "close")
                self.close_connection = True
            self.end_headers()
            self.wfile.write(data)

        def body_bytes(self, limit):
            n = int(self.headers.get("Content-Length") or 0)
            if n > limit:
                raise ApiError(413, f"That's too big (limit {limit // 1024 // 1024} MB).")
            return self.rfile.read(n) if n else b""

        def body_json(self):
            raw = self.body_bytes(2 * 1024 * 1024)
            try:
                return json.loads(raw or b"{}")
            except ValueError:
                raise ApiError(400, "The request wasn't valid JSON.")

        def send_file(self, path: Path, ctype: str, download_name=None, inline=True):
            size = path.stat().st_size
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("X-Content-Type-Options", "nosniff")
            if download_name:
                disp = "inline" if inline else "attachment"
                ascii_name = re.sub(r'[^\w.\- ()]', "_", download_name, flags=re.ASCII)
                self.send_header("Content-Disposition",
                                 f"{disp}; filename=\"{ascii_name}\"; filename*=UTF-8''{urllib.parse.quote(download_name)}")
            self.end_headers()
            with open(path, "rb") as f:
                shutil.copyfileobj(f, self.wfile)

        def start_stream(self):
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()

        def event(self, obj):
            data = (json.dumps(obj) + "\n").encode()
            self.wfile.write(b"%x\r\n%s\r\n" % (len(data), data))
            self.wfile.flush()

        def end_stream(self):
            self.wfile.write(b"0\r\n\r\n")
            self.wfile.flush()

        def do_GET(self):
            self.handle_route("GET")

        def do_POST(self):
            self.handle_route("POST")

        def do_PUT(self):
            self.handle_route("PUT")

        def do_DELETE(self):
            self.handle_route("DELETE")

        def handle_route(self, method):
            u = urllib.parse.urlsplit(self.path)
            self.qs = {k: v[-1] for k, v in urllib.parse.parse_qs(u.query).items()}
            path = u.path
            try:
                if not host_allowed(self.headers.get("Host"), app.allowed_hosts):
                    raise ApiError(403, "Unknown host name. Open the hub by its IP address, or start it with "
                                        "--allow-host NAME to allow this name.")
                if not path.startswith("/api/"):
                    if method != "GET":
                        raise ApiError(405, "Not allowed.")
                    return self.static(path)
                # A custom header can't be sent cross-site without CORS approval, so other websites
                # open in the same browser can't change your library.
                if method != "GET" and self.headers.get("X-Hub") != "1":
                    raise ApiError(403, "Missing X-Hub header.")
                for m, rx, fn in ROUTES:
                    if m == method:
                        match = re.fullmatch(rx, path)
                        if match:
                            return fn(self, *match.groups())
                raise ApiError(404, "No such API route.")
            except ApiError as e:
                self.send_json({"error": e.message}, e.status)
            except IngestError as e:
                self.send_json({"error": str(e)}, 400)
            except (BrokenPipeError, ConnectionResetError):
                pass
            except Exception as e:
                traceback.print_exc()
                try:
                    self.send_json({"error": f"Something went wrong on the server ({e.__class__.__name__}: {e})."}, 500)
                except Exception:
                    pass

        def static(self, path):
            if path in ("", "/"):
                path = "/index.html"
            target = (STATIC / path.lstrip("/")).resolve()
            if STATIC not in target.parents or not target.is_file():
                raise ApiError(404, "Not found.")
            ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype in ("application/javascript",):
                ctype += "; charset=utf-8"
            self.send_file(target, ctype)

        # ---------- API ----------
        def api_status(self):
            st = app.model_status()
            with store.db() as c:
                counts = {
                    "documents": c.execute("select count(*) from documents").fetchone()[0],
                    "passages": c.execute("select count(*) from chunks").fetchone()[0],
                    "guides": c.execute("select count(*) from guides").fetchone()[0],
                }
            self.send_json({
                "version": VERSION, "ollama": st, "ollama_url": app.ollama_url, "wanted_model": app.wanted_model(),
                "counts": counts, "data_dir": str(store.data_dir), "pdf_support": pdf_support(),
                "lan_urls": lan_urls(app.port) if self.qs.get("lan") else None,
            })

        def api_settings(self):
            body = self.body_json()
            if "model" in body:
                m = str(body["model"] or "").strip()
                store.set_setting("model", m)
            self.send_json({"ok": True, "wanted_model": app.wanted_model()})

        def api_categories(self):
            with store.db() as c:
                d = dict(c.execute("select category, count(*) from documents group by category").fetchall())
                g = dict(c.execute("select category, count(*) from guides group by category").fetchall())
            self.send_json([{**cat, "documents": d.get(cat["name"], 0), "guides": g.get(cat["name"], 0)} for cat in CATEGORIES])

        def api_documents(self):
            sql, args = "select * from documents", []
            if self.qs.get("category"):
                sql += " where category=?"
                args.append(self.qs["category"])
            with store.db() as c:
                counts = dict(c.execute("select doc_id, count(*) from chunks group by doc_id").fetchall())
                docs = [dict(r) for r in c.execute(sql + " order by added_at desc, id desc", args)]
            for d in docs:
                d["passages"] = counts.get(d["id"], 0)
            self.send_json(docs)

        def api_import(self):
            name = self.qs.get("filename") or ""
            data = self.body_bytes(MAX_BYTES)
            result = ingest(store, name, data, self.qs.get("category") or None)
            self.send_json(result)

        def doc_row(self, doc_id):
            with store.db() as c:
                row = c.execute("select * from documents where id=?", (int(doc_id),)).fetchone()
            if not row:
                raise ApiError(404, "That document isn't in the library (it may have been deleted).")
            return dict(row)

        def api_doc_update(self, doc_id):
            doc = self.doc_row(doc_id)
            body = self.body_json()
            cat = body.get("category", doc["category"])
            if cat and cat not in CATEGORY_NAMES:
                raise ApiError(400, "Unknown category.")
            title = str(body.get("title") or doc["title"]).strip()[:200]
            with store.db() as c:
                c.execute("update documents set category=?, title=? where id=?", (cat or None, title, doc["id"]))
            self.send_json({**doc, "category": cat or None, "title": title})

        def api_doc_delete(self, doc_id):
            if not delete_document(store, int(doc_id)):
                raise ApiError(404, "That document isn't in the library.")
            self.send_json({"ok": True})

        def api_doc_file(self, doc_id):
            doc = self.doc_row(doc_id)
            path = store.files_dir / doc["stored_name"]
            if not path.is_file():
                raise ApiError(404, "The original file is missing from the data folder.")
            # Text and Markdown are shown as plain text, never rendered as a web page.
            ctype = "application/pdf" if doc["kind"] == "pdf" else "text/plain; charset=utf-8"
            self.send_file(path, ctype, doc["filename"], inline=self.qs.get("download") != "1")

        def api_doc_text(self, doc_id):
            doc = self.doc_row(doc_id)
            sql, args = "select page, page_label, section, text from chunks where doc_id=?", [doc["id"]]
            if self.qs.get("page"):
                if not self.qs["page"].isdigit():
                    raise ApiError(400, "Page must be a number.")
                sql += " and page=?"
                args.append(int(self.qs["page"]))
            with store.db() as c:
                rows = [dict(r) for r in c.execute(sql + " order by ord limit 2000", args)]
            self.send_json({"document": doc, "passages": rows})

        def api_search(self):
            q = (self.qs.get("q") or "").strip()[:500]
            rows = search.search(store, q, limit=min(int(self.qs.get("limit") or 30), 100),
                                 category=self.qs.get("category") or None)
            for r in rows:
                r["where"] = search.place(r)
                r["open_url"] = f"/api/documents/{r['doc_id']}/file" + (f"#page={r['page']}" if r["kind"] == "pdf" and r["page"] else "")
            guides = []
            words = search.terms(q)
            if words:
                with store.db() as c:
                    for g in c.execute("select id, title, category, kind, body, items from guides"):
                        hay = f"{g['title']} {g['body']} {g['items']}".lower()
                        hits = sum(1 for w in words if w in hay)
                        if hits:
                            guides.append((hits, {"id": g["id"], "title": g["title"], "category": g["category"], "kind": g["kind"]}))
            guides.sort(key=lambda x: -x[0])
            self.send_json({"query": q, "results": rows, "guides": [g for _, g in guides[:10]]})

        def api_chat(self):
            body = self.body_json()
            question = str(body.get("question") or "").strip()[:2000]
            if not question:
                raise ApiError(400, "Type a question first.")
            history = body.get("history") if isinstance(body.get("history"), list) else []
            strict = bool(body.get("strict"))
            # Short follow-ups ("what about for babies?") also search with the previous question's words.
            rq = question
            prev = next((h.get("content", "") for h in reversed(history) if h.get("role") == "user"), "")
            if prev and len(search.terms(question)) < 3:
                rq = f"{question} {prev}"
            sources, evidence = search.retrieve(store, rq, category=body.get("category") or None)
            risk_list = rag.risks(question)
            self.start_stream()
            self.event({"type": "sources", "evidence": evidence, "risks": risk_list,
                        "sources": [rag.public_source(i, s) for i, s in enumerate(sources, 1)]})
            if strict and not sources:
                self.event({"type": "done", "notice": "Your library has nothing that matches, and you asked for "
                            "answers only from your documents, so the AI wasn't asked.", "checks": None})
                return self.end_stream()
            st = app.model_status()
            if not st["ok"]:
                self.event({"type": "unavailable", "message": st["message"]})
                return self.end_stream()
            messages = rag.build_messages(question, sources, history, risk_list, strict)
            answer = ""
            try:
                for piece in ollama.chat_stream(app.ollama_url, st["model"], messages):
                    answer += piece
                    self.event({"type": "token", "text": piece})
            except ollama.OllamaError as e:
                self.event({"type": "error", "message": str(e)})
            self.event({"type": "done", "model": st["model"], "checks": rag.verify(answer, sources)})
            self.end_stream()

        def doc_ids(self):
            with store.db() as c:
                return {r[0] for r in c.execute("select id from documents")}

        def api_guides(self):
            sql, args = "select * from guides", []
            if self.qs.get("category"):
                sql += " where category=?"
                args.append(self.qs["category"])
            docs = self.doc_ids()
            with store.db() as c:
                self.send_json([guide_out(r, docs) for r in c.execute(sql + " order by updated_at desc, id desc", args)])

        def guide_row(self, gid):
            with store.db() as c:
                row = c.execute("select * from guides where id=?", (int(gid),)).fetchone()
            if not row:
                raise ApiError(404, "That guide doesn't exist (it may have been deleted).")
            return row

        def api_guide(self, gid):
            self.send_json(guide_out(self.guide_row(gid), self.doc_ids()))

        def guide_fields(self, body, old=None):
            old = dict(old) if old else {}
            title = str(body.get("title", old.get("title", "")) or "").strip()[:200]
            if not title:
                raise ApiError(400, "Give the guide a title.")
            cat = body.get("category", old.get("category"))
            if cat and cat not in CATEGORY_NAMES:
                raise ApiError(400, "Unknown category.")
            kind = body.get("kind", old.get("kind", "guide"))
            if kind not in ("guide", "checklist"):
                raise ApiError(400, "Kind must be guide or checklist.")
            items = clean_items(body["items"]) if "items" in body else json.loads(old.get("items", "[]"))
            sources = clean_sources(body["sources"]) if "sources" in body else json.loads(old.get("sources", "[]"))
            text = str(body.get("body", old.get("body", "")) or "")[:200000]
            return title, cat or None, kind, text, json.dumps(items), json.dumps(sources)

        def api_guide_create(self):
            body = self.body_json()
            origin = body.get("origin") if body.get("origin") in ("user", "chat") else "user"
            f = self.guide_fields(body)
            with store.db() as c:
                cur = c.execute("insert into guides (title, category, kind, body, items, sources, origin, created_at, updated_at)"
                                " values (?,?,?,?,?,?,?,?,?)", (*f, origin, now(), now()))
                gid = cur.lastrowid
            self.api_guide(gid)

        def api_guide_update(self, gid):
            old = self.guide_row(gid)
            f = self.guide_fields(self.body_json(), old)
            with store.db() as c:
                c.execute("update guides set title=?, category=?, kind=?, body=?, items=?, sources=?, updated_at=? where id=?",
                          (*f, now(), old["id"]))
            self.api_guide(gid)

        def api_guide_delete(self, gid):
            row = self.guide_row(gid)
            with store.db() as c:
                c.execute("delete from guides where id=?", (row["id"],))
            self.send_json({"ok": True})

        def api_backup(self):
            with tempfile.TemporaryDirectory() as tmp:
                path = backup.make_backup(store, Path(tmp) / "backup.zip")
                name = f"emergency-hub-backup-{time.strftime('%Y%m%d-%H%M')}.zip"
                self.send_file(path, "application/zip", name, inline=False)

    D = r"(\d+)"
    ROUTES = [
        ("GET", r"/api/status", Handler.api_status),
        ("PUT", r"/api/settings", Handler.api_settings),
        ("GET", r"/api/categories", Handler.api_categories),
        ("GET", r"/api/documents", Handler.api_documents),
        ("POST", r"/api/documents", Handler.api_import),
        ("PUT", rf"/api/documents/{D}", Handler.api_doc_update),
        ("DELETE", rf"/api/documents/{D}", Handler.api_doc_delete),
        ("GET", rf"/api/documents/{D}/file", Handler.api_doc_file),
        ("GET", rf"/api/documents/{D}/text", Handler.api_doc_text),
        ("GET", r"/api/search", Handler.api_search),
        ("POST", r"/api/chat", Handler.api_chat),
        ("GET", r"/api/guides", Handler.api_guides),
        ("POST", r"/api/guides", Handler.api_guide_create),
        ("GET", rf"/api/guides/{D}", Handler.api_guide),
        ("PUT", rf"/api/guides/{D}", Handler.api_guide_update),
        ("DELETE", rf"/api/guides/{D}", Handler.api_guide_delete),
        ("GET", r"/api/backup", Handler.api_backup),
    ]
    return Handler


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def make_server(app: App, host="0.0.0.0", port=8080) -> Server:
    srv = Server((host, port), make_handler(app))
    app.port = srv.server_address[1]
    return srv


def serve(app: App, host="0.0.0.0", port=8080):
    try:
        srv = make_server(app, host, port)
    except OSError as e:
        sys.exit(f"Couldn't start on port {port} ({e}). Is the hub already running? Try --port 8081.")
    print(f"\nEmergency Hub is running.\n  On this computer:  http://127.0.0.1:{app.port}")
    if host in ("0.0.0.0", ""):
        for u in lan_urls(app.port):
            print(f"  Phones/tablets on the same Wi-Fi:  {u}")
        print("  (Anyone on your network can open it. Use --host 127.0.0.1 to keep it to this computer.)")
    st = app.model_status()
    print(f"  AI: {st['message']}")
    print(f"  Data folder: {app.store.data_dir}\n  Press Ctrl+C to stop.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
