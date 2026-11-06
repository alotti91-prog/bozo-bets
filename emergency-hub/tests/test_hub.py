"""Run from the emergency-hub folder:  python -m unittest -v"""
import json
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from hub import backup, rag, search  # noqa: E402
from hub.db import Store  # noqa: E402
from hub.ingest import IngestError, chunk_text, delete_document, ingest  # noqa: E402
from hub.server import App, host_allowed, make_server  # noqa: E402
from tests.fake_ollama import FakeOllama  # noqa: E402
from tests.make_pdf import make_pdf  # noqa: E402

WATER_PDF = [
    "Emergency Water Guide\nIf tap water may be unsafe, use bottled water first.",
    "Boiling\nBring clear water to a rolling boil for one minute, then let it cool.\nStore it in clean covered containers.",
    "",  # a scanned page: no text layer
    "Storage\nRotate stored water every six months.",
]
MD = """# Power Outage Notes

## Generators
Never run a generator indoors or in a garage. Keep it far from windows.

## Food
Keep the freezer door closed to hold the cold.
"""

_noproxy = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.store = Store(self.tmp / "data")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestIngest(Base):
    def test_pdf_pages_and_dedupe(self):
        r = ingest(self.store, "water-guide.pdf", make_pdf(WATER_PDF), "Water and Sanitation")
        self.assertFalse(r["duplicate"])
        doc = r["document"]
        self.assertEqual((doc["kind"], doc["pages"], doc["category"]), ("pdf", 4, "Water and Sanitation"))
        self.assertTrue((self.store.files_dir / doc["stored_name"]).is_file())
        hits = search.search(self.store, "rolling boil")
        self.assertEqual(hits[0]["page"], 2)
        self.assertEqual(hits[0]["filename"], "water-guide.pdf")
        self.assertEqual(search.search(self.store, "rotate")[0]["page"], 4)
        again = ingest(self.store, "copy.pdf", make_pdf(WATER_PDF))
        self.assertTrue(again["duplicate"])

    def test_scanned_pdf_warns(self):
        r = ingest(self.store, "scan.pdf", make_pdf(["", ""]))
        self.assertEqual(r["document"]["chars"], 0)
        self.assertTrue(any("OCR" in w for w in r["warnings"]))

    def test_markdown_sections_and_txt(self):
        ingest(self.store, "power.md", MD.encode())
        hit = search.search(self.store, "generator garage")[0]
        self.assertEqual(hit["section"], "Power Outage Notes › Generators")
        self.assertEqual(hit["title"], "Power Outage Notes")
        ingest(self.store, "notes.txt", "Caf\xe9 list: candles, matches.".encode("cp1252"))
        self.assertEqual(search.search(self.store, "candles")[0]["kind"], "txt")

    def test_rejects_bad_files(self):
        with self.assertRaises(IngestError):
            ingest(self.store, "virus.exe", b"MZ")
        with self.assertRaises(IngestError):
            ingest(self.store, "empty.txt", b"")
        with self.assertRaises(IngestError):
            ingest(self.store, "broken.pdf", b"%PDF-1.4 garbage")
        self.assertEqual(list(self.store.files_dir.iterdir()), [])

    def test_unsafe_filename_is_cleaned(self):
        r = ingest(self.store, "../../evil<script>.txt", b"hello water")
        self.assertNotIn("/", r["document"]["stored_name"])
        self.assertNotIn("<", r["document"]["filename"])

    def test_delete(self):
        doc = ingest(self.store, "power.md", MD.encode())["document"]
        self.assertTrue(delete_document(self.store, doc["id"]))
        self.assertEqual(search.search(self.store, "generator"), [])
        self.assertEqual(list(self.store.files_dir.iterdir()), [])

    def test_chunking_long_text(self):
        text = ("Water is life. " * 400).strip()
        chunks = chunk_text(text)
        self.assertGreater(len(chunks), 3)
        self.assertTrue(all(len(c) <= 1400 for c in chunks))
        self.assertEqual(chunk_text("x" * 5000)[0], "x" * 1400)


class TestSearch(Base):
    def test_query_is_safe(self):
        ingest(self.store, "power.md", MD.encode())
        for q in ['"', 'NEAR(', 'generator*', 'a AND OR NOT', "') drop table--", "", "the of and"]:
            search.search(self.store, q)  # must not raise
        self.assertEqual(search.fts_query("the of and"), None)
        self.assertEqual(search.fts_query('"rolling boil" water'), '"rolling boil" OR "water"')

    def test_retrieve_evidence(self):
        ingest(self.store, "water.pdf", make_pdf(WATER_PDF))
        ingest(self.store, "power.md", MD.encode())
        srcs, ev = search.retrieve(self.store, "How long should I boil water?")
        self.assertEqual(ev, "ok")
        self.assertEqual((srcs[0]["filename"], srcs[0]["page"]), ("water.pdf", 2))
        self.assertEqual(search.retrieve(self.store, "snakebite antivenom")[1], "none")
        _, weak = search.retrieve(self.store, "boil snake venom antidote hospital")
        self.assertEqual(weak, "weak")

    def test_category_filter(self):
        ingest(self.store, "water.pdf", make_pdf(WATER_PDF), "Water and Sanitation")
        ingest(self.store, "power.md", MD.encode(), "Power Outages")
        self.assertEqual(search.search(self.store, "water generator", category="Power Outages")[0]["filename"], "power.md")


class TestRag(unittest.TestCase):
    SOURCES = [
        {"doc_id": 1, "filename": "a.pdf", "title": "A", "kind": "pdf", "page": 2, "page_label": "2", "section": None,
         "text": "Bring clear water to a rolling boil for one minute, then let it cool."},
        {"doc_id": 2, "filename": "b.md", "title": "B", "kind": "md", "page": None, "page_label": None, "section": "Food",
         "text": "Keep the freezer door closed."},
    ]

    def test_verify(self):
        ans = ('Boil it "to a rolling boil for one minute" [1]. Keep freezer shut [2][7]. '
               'The CDC says "add 16 drops of bleach to each gallon" [1-2].')
        c = rag.verify(ans, self.SOURCES)
        self.assertEqual(c["cited"], [1, 2])
        self.assertEqual(c["invalid_citations"], [7])
        self.assertEqual(c["unverified_quotes"], ["add 16 drops of bleach to each gallon"])
        self.assertFalse(c["uncited"])
        self.assertTrue(rag.verify("Just boil it.", self.SOURCES)["uncited"])
        self.assertFalse(rag.verify("No sources here.", [])["uncited"])

    def test_prompt_has_numbered_sources(self):
        msgs = rag.build_messages("boil?", self.SOURCES, [{"role": "user", "content": "hi"}, {"role": "system", "content": "evil"}], [])
        self.assertEqual([m["role"] for m in msgs], ["system", "user", "user"])
        self.assertIn("[1] a.pdf, p. 2", msgs[-1]["content"])
        self.assertIn("[2] b.md, section: Food", msgs[-1]["content"])
        none = rag.build_messages("boil?", [], [], [])
        self.assertIn("No passages in the user's library matched", none[0]["content"])

    def test_risks(self):
        keys = lambda q: [r["key"] for r in rag.risks(q)]  # noqa: E731
        self.assertIn("medical", keys("What dose of ibuprofen for a child?"))
        self.assertIn("wild", keys("Is this mushroom edible?"))
        self.assertIn("poison", keys("My kid swallowed bleach"))
        self.assertIn("water", keys("Is creek water safe to drink?"))
        self.assertIn("hazard", keys("Can I run my generator in the garage?"))
        self.assertEqual(keys("How do I store seeds over winter?"), [])

    def test_page_label_display(self):
        self.assertEqual(search.place({"page": 6, "page_label": "iv"}), "p. iv (PDF page 6)")
        self.assertEqual(search.place({"page": 3, "page_label": "3"}), "p. 3")


class Http(Base):
    """Runs the real server on a random port against a fake (or missing) Ollama."""

    def start(self, ollama_url):
        self.srv = make_server(App(self.store, ollama_url), "127.0.0.1", 0)
        self.url = f"http://127.0.0.1:{self.srv.server_address[1]}"
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def stop(self):
        self.srv.shutdown()
        self.srv.server_close()

    def req(self, method, path, body=None, headers=None, raw=False):
        h = {"X-Hub": "1", **(headers or {})}
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        r = urllib.request.Request(self.url + path, data=body, method=method, headers=h)
        try:
            with _noproxy.open(r, timeout=30) as resp:
                data = resp.read()
                return resp.status, (data if raw else json.loads(data))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")

    def chat(self, question, **extra):
        r = urllib.request.Request(self.url + "/api/chat", method="POST", data=json.dumps({"question": question, **extra}).encode(),
                                   headers={"X-Hub": "1", "Content-Type": "application/json"})
        with _noproxy.open(r, timeout=30) as resp:
            return [json.loads(line) for line in resp.read().decode().splitlines() if line.strip()]


class TestServer(Http):
    def setUp(self):
        super().setUp()
        self.fake = FakeOllama()
        self.start(self.fake.url)

    def tearDown(self):
        self.stop()
        self.fake.close()
        super().tearDown()

    def upload(self, name, data, category=""):
        return self.req("POST", f"/api/documents?filename={urllib.request.quote(name)}&category={urllib.request.quote(category)}", data,
                        {"Content-Type": "application/octet-stream"})

    def test_core_workflow(self):
        code, r = self.upload("water-guide.pdf", make_pdf(WATER_PDF), "Water and Sanitation")
        self.assertEqual(code, 200, r)
        doc_id = r["document"]["id"]

        code, s = self.req("GET", "/api/search?q=rolling%20boil")
        self.assertEqual(s["results"][0]["page"], 2)
        self.assertEqual(s["results"][0]["open_url"], f"/api/documents/{doc_id}/file#page=2")
        self.assertIn("\x02", s["results"][0]["snippet"])

        self.fake.reply = ('From your documents:\n- Bring water to a rolling boil for one minute [1]. '
                           'It says "Bring clear water to a rolling boil for one minute" [1]. Also [5].\n'
                           'General knowledge (not from your documents):\n- "Add 16 drops of bleach per gallon" works too.')
        events = self.chat("How long do I boil water to make it safe?")
        kinds = [e["type"] for e in events]
        self.assertEqual(kinds[0], "sources")
        self.assertEqual(kinds[-1], "done")
        self.assertIn("token", kinds)
        src = events[0]["sources"][0]
        self.assertEqual((src["n"], src["filename"], src["page"], src["where"]), (1, "water-guide.pdf", 2, "p. 2"))
        self.assertIn("water", [r["key"] for r in events[0]["risks"]])
        answer = "".join(e["text"] for e in events if e["type"] == "token")
        self.assertEqual(answer, self.fake.reply)
        checks = events[-1]["checks"]
        self.assertEqual(checks["cited"], [1])
        self.assertEqual(checks["invalid_citations"], [5])
        self.assertEqual(checks["unverified_quotes"], ["Add 16 drops of bleach per gallon"])
        # The model really got the retrieved passage, numbered, and the safety rules.
        sent = self.fake.requests[-1]["messages"]
        self.assertIn("Never invent a source", sent[0]["content"])
        self.assertIn("[1] water-guide.pdf, p. 2\nBoiling", sent[-1]["content"])
        self.assertEqual(self.fake.requests[-1]["model"], "llama3.2:3b")  # embedding model skipped

        code, raw = self.req("GET", f"/api/documents/{doc_id}/file", raw=True)
        self.assertEqual(raw, make_pdf(WATER_PDF))  # original, byte for byte
        code, t = self.req("GET", f"/api/documents/{doc_id}/text?page=2")
        self.assertIn("rolling boil", t["passages"][0]["text"])

    def test_no_evidence(self):
        self.fake.reply = "Your documents don't cover this."
        events = self.chat("What is the capital of France?")
        self.assertEqual((events[0]["evidence"], events[0]["sources"]), ("none", []))
        self.assertIn("SOURCES: none matched", self.fake.requests[-1]["messages"][-1]["content"])
        n = len(self.fake.requests)
        events = self.chat("What is the capital of France?", strict=True)
        self.assertEqual(len(self.fake.requests), n)  # strict mode: the model isn't asked at all
        self.assertIn("wasn't asked", events[-1]["notice"])

    def test_wrong_model_setting(self):
        self.req("PUT", "/api/settings", {"model": "mistral"})
        self.upload("power.md", MD.encode())
        events = self.chat("generator indoors?")
        self.assertEqual(events[0]["type"], "sources")
        self.assertEqual(events[1]["type"], "unavailable")
        self.assertIn("ollama pull mistral", events[1]["message"])

    def test_guides(self):
        code, gl = self.req("GET", "/api/guides")
        self.assertGreaterEqual(len(gl), 8)
        self.assertTrue(all(g["origin"] == "starter" for g in gl))
        code, cats = self.req("GET", "/api/categories")
        self.assertEqual(len(cats), 8)
        self.assertTrue(all(c["guides"] >= 1 for c in cats))
        code, g = self.req("POST", "/api/guides", {"title": "Go bag", "kind": "checklist", "category": "Family Preparedness",
                                                  "items": ["Water", {"text": "Torch", "done": True}, "  "]})
        self.assertEqual(code, 200)
        self.assertEqual(g["items"], [{"text": "Water", "done": False}, {"text": "Torch", "done": True}])
        code, g = self.req("PUT", f"/api/guides/{g['id']}", {"items": [{"text": "Water", "done": True}]})
        self.assertEqual(g["items"][0]["done"], True)
        self.assertEqual(g["title"], "Go bag")
        code, g2 = self.req("POST", "/api/guides", {"title": "From chat", "body": "x [1]", "origin": "chat",
                                                   "sources": [{"n": 1, "doc_id": 999, "filename": "gone.pdf", "page": 3}]})
        self.assertTrue(g2["sources"][0]["missing"])
        self.assertEqual(self.req("POST", "/api/guides", {"title": ""})[0], 400)
        self.assertEqual(self.req("POST", "/api/guides", {"title": "x", "category": "Nope"})[0], 400)
        self.assertEqual(self.req("DELETE", f"/api/guides/{g['id']}")[0], 200)
        self.assertEqual(self.req("GET", f"/api/guides/{g['id']}")[0], 404)

    def test_guards(self):
        code, r = self.req("DELETE", "/api/documents/1", headers={"X-Hub": ""})
        self.assertEqual(code, 403)  # other websites can't send this header without CORS approval
        self.assertEqual(self.req("GET", "/../hub/db.py")[0], 404)
        self.assertEqual(self.req("GET", "/api/documents/12345/file")[0], 404)
        code, r = self.upload("evil.html", b"<script>alert(1)</script>")
        self.assertEqual(code, 400)
        code, r = self.upload("x.md", b"<script>alert(1)</script>")
        with _noproxy.open(self.url + f"/api/documents/{r['document']['id']}/file") as resp:
            self.assertTrue(resp.headers["Content-Type"].startswith("text/plain"))
            self.assertEqual(resp.headers["X-Content-Type-Options"], "nosniff")

    def test_unicode_filename_and_bad_page(self):
        code, r = self.upload("急救 guide.txt", "Apply pressure to the wound.".encode())
        self.assertEqual(code, 200, r)
        with _noproxy.open(self.url + f"/api/documents/{r['document']['id']}/file") as resp:
            self.assertEqual(resp.read(), "Apply pressure to the wound.".encode())
            self.assertIn("filename*=UTF-8''", resp.headers["Content-Disposition"])
        self.assertEqual(self.req("GET", f"/api/documents/{r['document']['id']}/text?page=abc")[0], 400)

    def test_host_check(self):
        for ok in ["127.0.0.1:8080", "localhost:8080", "192.168.1.20:8080", "[::1]:8080", "kitchen-pc:8080",
                   "kitchen-pc.local:8080", "nas.lan", ""]:
            self.assertTrue(host_allowed(ok), ok)
        for bad in ["evil.example.com:8080", "attacker.com"]:
            self.assertFalse(host_allowed(bad), bad)
        self.assertTrue(host_allowed("hub.example.org:80", {"hub.example.org"}))
        r = urllib.request.Request(self.url + "/api/status", headers={"Host": "rebind.attacker.com"})
        with self.assertRaises(urllib.error.HTTPError) as e:
            _noproxy.open(r)
        self.assertEqual(e.exception.code, 403)

    def test_static_is_offline(self):
        with _noproxy.open(self.url + "/") as resp:
            html = resp.read().decode()
        self.assertIn("Emergency Hub", html)
        for f in (ROOT / "static").iterdir():
            text = f.read_text()
            self.assertNotRegex(text, r"(src|href)=[\"']?(https?:)?//", f"{f.name} loads something remotely")
            self.assertNotRegex(text, r"@import|url\(\s*['\"]?https?:", f.name)
            self.assertNotRegex(text, r"fetch\(\s*['\"`]https?:", f.name)


class TestModelUnavailable(Http):
    def test_library_still_works(self):
        self.start("http://127.0.0.1:9")  # nothing listens here
        try:
            code, st = self.req("GET", "/api/status")
            self.assertFalse(st["ollama"]["running"])
            self.assertIn("isn't running", st["ollama"]["message"])
            self.req("POST", "/api/documents?filename=power.md", MD.encode())
            events = self.chat("Can I run a generator in the garage?")
            self.assertEqual(events[0]["sources"][0]["filename"], "power.md")  # passages still come back
            self.assertEqual(events[1]["type"], "unavailable")
            self.assertEqual(self.req("GET", "/api/search?q=freezer")[1]["results"][0]["section"], "Power Outage Notes › Food")
        finally:
            self.stop()

    def test_no_models_installed(self):
        fake = FakeOllama(models=["nomic-embed-text:latest"])
        self.start(fake.url)
        try:
            st = self.req("GET", "/api/status")[1]["ollama"]
            self.assertTrue(st["running"])
            self.assertFalse(st["ok"])
            self.assertIn("ollama pull", st["message"])
        finally:
            self.stop()
            fake.close()


class TestPersistenceAndBackup(Http):
    def test_restart_keeps_data(self):
        fake = FakeOllama()
        self.start(fake.url)
        self.req("POST", "/api/documents?filename=power.md&category=Power%20Outages", MD.encode())
        self.req("POST", "/api/guides", {"title": "My plan", "body": "Meet at the oak tree."})
        self.stop()
        self.store = Store(self.tmp / "data")  # a fresh process would do exactly this
        self.start(fake.url)
        try:
            docs = self.req("GET", "/api/documents")[1]
            self.assertEqual([d["filename"] for d in docs], ["power.md"])
            self.assertEqual(docs[0]["category"], "Power Outages")
            self.assertTrue(any(g["title"] == "My plan" for g in self.req("GET", "/api/guides")[1]))
            self.assertEqual(self.req("GET", "/api/search?q=freezer")[1]["results"][0]["filename"], "power.md")
            code, z = self.req("GET", "/api/backup", raw=True)
            self.assertEqual(z[:2], b"PK")
        finally:
            self.stop()
            fake.close()

    def test_backup_restore_roundtrip(self):
        ingest(self.store, "water.pdf", make_pdf(WATER_PDF))
        out = backup.make_backup(self.store, self.tmp / "b.zip")
        with zipfile.ZipFile(out) as z:
            self.assertIn("hub.db", z.namelist())
            self.assertEqual(len([n for n in z.namelist() if n.startswith("files/")]), 1)
        ingest(self.store, "power.md", MD.encode())  # change after the backup
        old = backup.restore_backup(out, self.tmp / "data")
        self.assertTrue(old.exists())  # previous data kept aside, not deleted
        store = Store(self.tmp / "data")
        self.assertEqual(search.search(store, "generator"), [])
        hit = search.search(store, "rolling boil")[0]
        self.assertEqual(hit["page"], 2)
        with store.db() as c:
            stored = c.execute("select stored_name from documents").fetchone()[0]
        self.assertTrue((store.files_dir / stored).is_file())

    def test_restore_rejects_bad_zip(self):
        bad = self.tmp / "bad.zip"
        with zipfile.ZipFile(bad, "w") as z:
            z.writestr("hub.db", b"not a database")
        with self.assertRaises(ValueError):
            backup.restore_backup(bad, self.tmp / "data")
        evil = self.tmp / "evil.zip"
        with zipfile.ZipFile(evil, "w") as z:
            z.writestr("hub.db", b"")
            z.writestr("../../escape.txt", b"x")
        with self.assertRaises(ValueError):
            backup.restore_backup(evil, self.tmp / "data")
        self.assertTrue((self.tmp / "data" / "hub.db").is_file())  # untouched


if __name__ == "__main__":
    unittest.main()
