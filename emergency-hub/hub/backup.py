"""Backup = one zip with the database and the original files. Restore never deletes: the old data is kept aside."""
from __future__ import annotations

import shutil
import sqlite3
import tempfile
import time
import zipfile
from pathlib import Path


def make_backup(store, out_path) -> Path:
    out_path = Path(out_path)
    with tempfile.TemporaryDirectory() as tmp:
        snap = Path(tmp) / "hub.db"
        src = sqlite3.connect(store.db_path)
        dst = sqlite3.connect(snap)
        with dst:
            src.backup(dst)  # consistent copy even while the server is running
        src.close()
        dst.close()
        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(snap, "hub.db")
            for f in sorted(store.files_dir.iterdir()):
                if f.is_file():
                    z.write(f, f"files/{f.name}")
    return out_path


def restore_backup(zip_path, data_dir) -> Path | None:
    """Replace data_dir with the backup's contents. Returns where the old data was moved (or None)."""
    zip_path, data_dir = Path(zip_path), Path(data_dir).resolve()
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        if "hub.db" not in names:
            raise ValueError("That zip isn't an Emergency Hub backup (no hub.db inside).")
        for n in names:
            if n != "hub.db" and not (n.startswith("files/") and "/" not in n[6:] and ".." not in n):
                raise ValueError(f"Unexpected file in backup: {n}")
        staging = data_dir.parent / f".restore-{int(time.time())}"
        staging.mkdir(parents=True)
        z.extractall(staging)
    (staging / "files").mkdir(exist_ok=True)
    con = sqlite3.connect(staging / "hub.db")
    try:
        if con.execute("pragma integrity_check").fetchone()[0] != "ok":
            raise ValueError("The database in this backup is damaged.")
        con.execute("select count(*) from documents").fetchone()
    except (sqlite3.DatabaseError, ValueError) as e:
        con.close()
        shutil.rmtree(staging)
        raise ValueError(str(e) if isinstance(e, ValueError) else f"The database in this backup can't be read ({e}).")
    con.close()
    old = None
    if data_dir.exists():
        old = data_dir.parent / f"{data_dir.name}.before-restore-{time.strftime('%Y%m%d-%H%M%S')}"
        data_dir.rename(old)
    staging.rename(data_dir)
    return old
