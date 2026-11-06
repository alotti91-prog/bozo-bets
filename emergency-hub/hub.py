#!/usr/bin/env python3
"""Offline Emergency Knowledge Hub.

  python hub.py                         start the app (http://127.0.0.1:8080)
  python hub.py import FILE_OR_FOLDER   add PDF/TXT/MD files (folders are searched)
  python hub.py backup [out.zip]        save everything to one zip
  python hub.py restore backup.zip      replace the data folder with a backup (stop the app first)
  python hub.py check                   show what's working

Options: --data DIR (default ./data next to this file), --port, --host, --ollama URL, --model NAME,
         --allow-host NAME (if you open the hub by a custom host name)
"""
import argparse
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from hub import backup, ollama  # noqa: E402
from hub.db import CATEGORY_NAMES, Store  # noqa: E402
from hub.ingest import SUPPORTED, IngestError, ingest, pdf_support  # noqa: E402
from hub.server import App, serve  # noqa: E402


def main(argv=None):
    p = argparse.ArgumentParser(description="Offline Emergency Knowledge Hub")
    p.add_argument("command", nargs="?", default="serve", choices=["serve", "import", "backup", "restore", "check"])
    p.add_argument("paths", nargs="*")
    p.add_argument("--data", default=os.environ.get("HUB_DATA", str(HERE / "data")))
    p.add_argument("--host", default=os.environ.get("HUB_HOST", "0.0.0.0"))
    p.add_argument("--port", type=int, default=int(os.environ.get("HUB_PORT", "8080")))
    p.add_argument("--ollama", default=os.environ.get("OLLAMA_HOST_URL", "http://127.0.0.1:11434"))
    p.add_argument("--model", default=os.environ.get("HUB_MODEL"))
    p.add_argument("--allow-host", action="append", default=os.environ.get("HUB_ALLOWED_HOSTS", "").split(","),
                   help="extra host name the hub may be opened by (repeatable)")
    p.add_argument("--category", choices=CATEGORY_NAMES, help="category for imported files")
    a = p.parse_args(argv)

    if a.command == "restore":
        if len(a.paths) != 1:
            sys.exit("Usage: python hub.py restore BACKUP.zip   (stop the running app first)")
        try:
            old = backup.restore_backup(a.paths[0], a.data)
        except (ValueError, OSError) as e:
            sys.exit(f"Restore failed: {e}")
        print(f"Restored into {Path(a.data).resolve()}")
        if old:
            print(f"Your previous data was kept at {old} (delete it once you're happy).")
        return

    store = Store(a.data)
    if a.command == "serve":
        serve(App(store, a.ollama, a.model, allowed_hosts=a.allow_host), a.host, a.port)
    elif a.command == "import":
        if not a.paths:
            sys.exit("Usage: python hub.py import FILE_OR_FOLDER ... [--category 'First Aid']")
        files = []
        for raw in a.paths:
            path = Path(raw)
            if path.is_dir():
                files += sorted(f for f in path.rglob("*") if f.is_file() and f.suffix.lower() in SUPPORTED)
            elif path.is_file():
                files.append(path)
            else:
                print(f"  not found: {raw}")
        ok = 0
        for f in files:
            try:
                r = ingest(store, f.name, f.read_bytes(), a.category)
            except (IngestError, OSError) as e:
                print(f"  FAILED  {f.name}: {e}")
                continue
            ok += 1
            if r["duplicate"]:
                print(f"  already in library: {f.name}")
            else:
                print(f"  imported {f.name} ({r['passages']} passages)")
            for w in r["warnings"]:
                print(f"     note: {w}")
        print(f"Done: {ok} of {len(files)} file(s).")
    elif a.command == "backup":
        out = Path(a.paths[0]) if a.paths else Path.cwd() / f"emergency-hub-backup-{time.strftime('%Y%m%d-%H%M')}.zip"
        backup.make_backup(store, out)
        print(f"Backup saved: {out.resolve()}")
    elif a.command == "check":
        with store.db() as c:
            docs = c.execute("select count(*) from documents").fetchone()[0]
            chunks = c.execute("select count(*) from chunks").fetchone()[0]
        st = ollama.status(a.ollama, store.get_setting("model") or a.model)
        print(f"Data folder: {store.data_dir}")
        print(f"Library: {docs} document(s), {chunks} searchable passages")
        print(f"PDF import: {'yes' if pdf_support() else 'NO - run: pip install pypdf'}")
        print(f"AI: {st['message']}")
        if st["models"]:
            print(f"Installed models: {', '.join(st['models'])}")


if __name__ == "__main__":
    main()
