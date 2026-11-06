"""SQLite storage: documents, searchable passages (FTS5), guides, settings.

Everything lives in one data folder:
  data/hub.db     - this database
  data/files/     - the original imported files, unchanged
"""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

CATEGORIES = [
    {"name": "First Aid", "icon": "\U0001FA79"},
    {"name": "Water and Sanitation", "icon": "\U0001F4A7"},
    {"name": "Food and Preservation", "icon": "\U0001F96B"},
    {"name": "Gardening", "icon": "\U0001F331"},
    {"name": "Foraging", "icon": "\U0001F33F"},
    {"name": "Home Repairs", "icon": "\U0001F527"},
    {"name": "Power Outages", "icon": "\U0001F526"},
    {"name": "Family Preparedness", "icon": "\U0001F46A"},
]
CATEGORY_NAMES = [c["name"] for c in CATEGORIES]

SCHEMA = """
create table if not exists documents (
  id integer primary key,
  title text not null,
  filename text not null,
  stored_name text not null,
  kind text not null,              -- pdf | txt | md
  category text,
  size integer not null,
  sha256 text not null unique,
  pages integer,
  chars integer not null default 0,
  added_at text not null
);
-- One row per passage. Only `text` and `title` are searchable; the rest says where it came from.
create virtual table if not exists chunks using fts5(
  text, title,
  doc_id unindexed, page unindexed, page_label unindexed, section unindexed, ord unindexed,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
create table if not exists guides (
  id integer primary key,
  title text not null,
  category text,
  kind text not null default 'guide',     -- guide | checklist
  body text not null default '',
  items text not null default '[]',       -- checklist: [{"text": "...", "done": false}]
  sources text not null default '[]',     -- [{"doc_id": 1, "filename": "...", "page": 3}]
  origin text not null default 'user',    -- starter | user | chat
  created_at text not null,
  updated_at text not null
);
create table if not exists settings (key text primary key, value text);
"""


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")


class Store:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir).resolve()
        self.files_dir = self.data_dir / "files"
        self.files_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "hub.db"
        with self.db() as c:
            c.execute("pragma journal_mode=wal")
            try:
                c.executescript(SCHEMA)
            except sqlite3.OperationalError as e:
                if "fts5" in str(e).lower():
                    raise SystemExit("This Python's SQLite has no FTS5 full-text search. Install Python 3.9+ from python.org.")
                raise
        self._seed()

    @contextmanager
    def db(self):
        c = sqlite3.connect(self.db_path, timeout=15)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        finally:
            c.close()

    def _seed(self):
        """Add the starter guides once. Deleting one later does not bring it back."""
        from .starter_guides import STARTER_GUIDES
        import json
        with self.db() as c:
            if c.execute("select 1 from settings where key='seeded'").fetchone():
                return
            for g in STARTER_GUIDES:
                items = [{"text": t, "done": False} for t in g.get("items", [])]
                c.execute(
                    "insert into guides (title, category, kind, body, items, sources, origin, created_at, updated_at)"
                    " values (?,?,?,?,?,'[]','starter',?,?)",
                    (g["title"], g["category"], g["kind"], g["body"], json.dumps(items), now(), now()),
                )
            c.execute("insert into settings (key, value) values ('seeded', '1')")

    def get_setting(self, key, default=None):
        with self.db() as c:
            row = c.execute("select value from settings where key=?", (key,)).fetchone()
        return row["value"] if row else default

    def set_setting(self, key, value):
        with self.db() as c:
            c.execute("insert into settings (key, value) values (?, ?) on conflict(key) do update set value=excluded.value", (key, value))
