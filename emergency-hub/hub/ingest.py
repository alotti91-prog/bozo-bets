"""Import PDF, TXT and Markdown files: keep the original, split the text into searchable passages."""
from __future__ import annotations

import hashlib
import io
import logging
import re
from pathlib import Path

from .db import CATEGORY_NAMES, now

SUPPORTED = {".pdf": "pdf", ".txt": "txt", ".md": "md", ".markdown": "md"}
MAX_BYTES = 300 * 1024 * 1024
TARGET, HARD = 900, 1400  # passage size in characters
logging.getLogger("pypdf").setLevel(logging.ERROR)  # we report unreadable PDFs ourselves


class IngestError(Exception):
    pass


def pdf_support() -> bool:
    try:
        import pypdf  # noqa: F401
        return True
    except ImportError:
        return False


def safe_name(name: str) -> str:
    base = (name or "").replace("\\", "/").split("/")[-1]
    base = re.sub(r"[^\w.\- ()]+", "_", base).strip(" ._")
    return (base or "document")[:120]


def decode_text(data: bytes) -> str:
    for enc in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            pass
    return data.decode("latin-1")


def split_long(p: str) -> list:
    if len(p) <= HARD:
        return [p]
    out, cur = [], ""
    for s in re.split(r"(?<=[.!?;:])\s+", p):
        while len(s) > HARD:  # no sentence breaks: cut on a space
            cut = s.rfind(" ", 0, HARD)
            cut = cut if cut > HARD // 2 else HARD
            out.append(s[:cut].strip())
            s = s[cut:].strip()
        if cur and len(cur) + len(s) + 1 > TARGET:
            out.append(cur)
            cur = s
        else:
            cur = f"{cur} {s}" if cur else s
    if cur:
        out.append(cur)
    return out


def chunk_text(text: str) -> list:
    pieces = []
    for p in re.split(r"\n\s*\n", text):
        p = p.strip()
        if p:
            pieces.extend(split_long(p))
    out, cur = [], ""
    for piece in pieces:
        if cur and len(cur) + len(piece) + 2 > TARGET:
            out.append(cur)
            cur = piece
        else:
            cur = f"{cur}\n\n{piece}" if cur else piece
    if cur:
        out.append(cur)
    return out


def clean(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"([a-z])-\n([a-z])", r"\1\2", text)  # re-join words hyphenated across lines
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_pdf(data: bytes):
    """Returns ([(page_number, page_label, text)], warnings). Page numbers are 1-based PDF pages."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise IngestError("PDF import needs the pypdf package. While online, run: pip install pypdf")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise IngestError("This PDF is password-protected. Save an unlocked copy and import that.")
        pages = list(reader.pages)
    except IngestError:
        raise
    except Exception as e:
        raise IngestError(f"Couldn't read this PDF ({e.__class__.__name__}). It may be damaged.")
    try:
        labels = list(reader.page_labels)
    except Exception:
        labels = []
    out, failed = [], 0
    for i, page in enumerate(pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text, failed = "", failed + 1
        label = labels[i] if i < len(labels) else str(i + 1)
        out.append((i + 1, label, clean(text)))
    warnings = []
    if failed:
        warnings.append(f"{failed} page(s) couldn't be read.")
    return out, warnings


def markdown_sections(text: str):
    """Yield (section path, text) blocks, following # headings (ignoring code blocks)."""
    stack, buf, fence = [], [], False

    def flush():
        body = "\n".join(buf).strip()
        if body:
            yield " › ".join(stack) or None, body

    for line in text.split("\n"):
        if line.lstrip().startswith("```"):
            fence = not fence
        m = None if fence else re.match(r"^(#{1,6})\s+(.+?)\s*#*\s*$", line)
        if m:
            yield from flush()
            buf = [line]  # keep the heading in the passage so it is searchable
            level = len(m.group(1))
            stack = stack[: level - 1] + [m.group(2).strip()]
        else:
            buf.append(line)
    yield from flush()


def extract(kind: str, data: bytes):
    """Returns (passages, pages, title_hint, warnings). A passage is (page, page_label, section, text)."""
    if kind == "pdf":
        pages, warnings = extract_pdf(data)
        passages = [(n, label, None, t) for n, label, text in pages for t in chunk_text(text)]
        return passages, len(pages), None, warnings
    text = clean(decode_text(data))
    if kind == "md":
        h1 = re.search(r"^#\s+(.+)$", text, re.M)
        passages = [(None, None, sec, t) for sec, body in markdown_sections(text) for t in chunk_text(body)]
        return passages, None, h1.group(1).strip() if h1 else None, []
    return [(None, None, None, t) for t in chunk_text(text)], None, None, []


def ingest(store, filename: str, data: bytes, category: str | None = None) -> dict:
    name = safe_name(filename)
    kind = SUPPORTED.get(Path(name).suffix.lower())
    if not kind:
        raise IngestError(f"{name}: only PDF, TXT and Markdown (.md) files can be imported.")
    if not data:
        raise IngestError(f"{name} is empty.")
    if len(data) > MAX_BYTES:
        raise IngestError(f"{name} is larger than {MAX_BYTES // 1024 // 1024} MB.")
    if category and category not in CATEGORY_NAMES:
        category = None
    sha = hashlib.sha256(data).hexdigest()
    with store.db() as c:
        row = c.execute("select * from documents where sha256=?", (sha,)).fetchone()
    if row:
        return {"document": dict(row), "duplicate": True, "warnings": []}

    passages, pages, title_hint, warnings = extract(kind, data)
    chars = sum(len(p[3]) for p in passages)
    if chars == 0:
        warnings.append("No text could be found, so it can be opened but not searched. "
                        "If it's a scanned PDF, run it through OCR first and import that copy.")
    title = title_hint or Path(name).stem.replace("_", " ").strip() or name
    stored = f"{sha[:12]}_{name}"
    path = store.files_dir / stored
    path.write_bytes(data)
    try:
        with store.db() as c:
            cur = c.execute(
                "insert into documents (title, filename, stored_name, kind, category, size, sha256, pages, chars, added_at)"
                " values (?,?,?,?,?,?,?,?,?,?)",
                (title, name, stored, kind, category, len(data), sha, pages, chars, now()),
            )
            doc_id = cur.lastrowid
            c.executemany(
                "insert into chunks (text, title, doc_id, page, page_label, section, ord) values (?,?,?,?,?,?,?)",
                [(t, f"{title} {name}", doc_id, page, label, sec, i) for i, (page, label, sec, t) in enumerate(passages)],
            )
            row = c.execute("select * from documents where id=?", (doc_id,)).fetchone()
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return {"document": dict(row), "duplicate": False, "warnings": warnings, "passages": len(passages)}


def delete_document(store, doc_id: int) -> bool:
    with store.db() as c:
        row = c.execute("select stored_name from documents where id=?", (doc_id,)).fetchone()
        if not row:
            return False
        c.execute("delete from chunks where doc_id=?", (doc_id,))
        c.execute("delete from documents where id=?", (doc_id,))
    (store.files_dir / row["stored_name"]).unlink(missing_ok=True)
    return True
