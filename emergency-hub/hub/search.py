"""Keyword search over passages (SQLite FTS5, BM25 ranking). No vector database needed."""
from __future__ import annotations

import re

STOP = set("""
a an and are as at be been but by can could do does did for from how i if in into is it its me my of on or our
should so that the their them then there these they this to was we were what when where which who why will with
would you your about after before during get got have has had not no than too very also any all just some more most
please tell explain know need want use using used make much many way best help us
""".split())

WORD = re.compile(r"[^\W_]+")


def terms(text: str) -> list:
    seen, out = set(), []
    for t in WORD.findall(text.lower()):
        if t in STOP or (len(t) < 2 and not t.isdigit()) or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out[:24]


def fts_query(text: str):
    """Turn free text into a safe FTS5 query: quoted "phrases" stay together, other words are OR'd."""
    parts = []
    for ph in re.findall(r'"([^"]+)"', text):
        toks = WORD.findall(ph.lower())
        if toks:
            parts.append('"' + " ".join(toks) + '"')
    rest = re.sub(r'"[^"]*"', " ", text)
    parts += [f'"{t}"' for t in terms(rest)]  # tokens are letters/digits only, so they can't break the syntax
    return " OR ".join(parts) or None


def search(store, text: str, limit: int = 20, category: str | None = None, doc_id: int | None = None) -> list:
    q = fts_query(text)
    if not q:
        return []
    sql = ("select chunks.rowid as id, chunks.doc_id, chunks.page, chunks.page_label, chunks.section, chunks.text,"
           " snippet(chunks, 0, char(2), char(3), ' … ', 32) as snippet, bm25(chunks, 1.0, 0.3) as score,"
           " d.filename, d.title, d.kind, d.category"
           " from chunks join documents d on d.id = chunks.doc_id where chunks match ?")
    args = [q]
    if category:
        sql += " and d.category = ?"
        args.append(category)
    if doc_id:
        sql += " and d.id = ?"
        args.append(doc_id)
    sql += " order by score limit ?"
    args.append(limit)
    with store.db() as c:
        return [dict(r) for r in c.execute(sql, args)]


def coverage(query_terms: list, text: str) -> float:
    """Share of the question's words that appear in a passage (prefix match stands in for stemming)."""
    if not query_terms:
        return 0.0
    words = set(WORD.findall(text.lower()))
    hit = 0
    for t in query_terms:
        stem = t[: max(4, len(t) - 3)] if len(t) > 4 else t
        if any(w.startswith(stem) for w in words):
            hit += 1
    return hit / len(query_terms)


def retrieve(store, text: str, k: int = 6, per_doc: int = 3, category: str | None = None):
    """Best passages for a question, at most `per_doc` from one document.
    Returns (passages, evidence) where evidence is 'none', 'weak' or 'ok'."""
    rows = search(store, text, limit=40, category=category)
    picked, per = [], {}
    for r in rows:
        if per.get(r["doc_id"], 0) >= per_doc:
            continue
        per[r["doc_id"]] = per.get(r["doc_id"], 0) + 1
        picked.append(r)
        if len(picked) >= k:
            break
    if not picked:
        return [], "none"
    qt = terms(text)
    best = max(coverage(qt, r["text"]) for r in picked)
    return picked, ("weak" if best < 0.5 else "ok")


def place(r: dict) -> str:
    """Human-readable location, e.g. 'p. 4' or 'p. iv (PDF page 6)' or a Markdown section."""
    if r.get("page"):
        label = r.get("page_label")
        if label and str(label) != str(r["page"]):
            return f"p. {label} (PDF page {r['page']})"
        return f"p. {r['page']}"
    return f"section: {r['section']}" if r.get("section") else ""
