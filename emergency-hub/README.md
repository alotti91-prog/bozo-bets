# Offline Emergency Knowledge Hub

A personal reference library for when the internet is down. Import PDF, TXT and Markdown files, search them,
ask questions and get answers that cite the exact file and page, and keep your own guides and checklists.
It runs entirely on your computer. Phones and tablets on the same Wi-Fi can use it too.

> **Reference aid only.** It is not a substitute for emergency services, a doctor or other qualified help.
> AI answers can be wrong. Check the cited passages in the original documents, especially for medical,
> poisoning, water-safety and wild-food questions.

## What you need

| | Needed for | Size |
|---|---|---|
| Python 3.9 or newer ([python.org](https://www.python.org/downloads/)) | everything | ~30 MB |
| `pypdf` (Python package) | importing PDFs | ~1 MB |
| [Ollama](https://ollama.com/download) + one model | AI answers (optional: search, documents and guides work without it) | 1–5 GB |

Download all of it **while you still have internet**. After that, nothing goes online.

## Install (once, while online)

```bash
cd emergency-hub
python3 -m pip install -r requirements.txt     # Windows: py -m pip install -r requirements.txt

# AI (optional but recommended): install Ollama from ollama.com, then pull one model
ollama pull llama3.2:3b      # ~2 GB download, needs ~4 GB free memory. Good default.
# ollama pull llama3.2:1b    # older or low-memory computers (weaker answers)
# ollama pull llama3.1:8b    # 16 GB+ memory: follows the citation rules better
```

Then fill your library while you're online: see [STARTER_RESOURCES.md](STARTER_RESOURCES.md).

## Start it

```bash
python3 hub.py          # or double-click start.bat (Windows) / run ./start.sh (Mac, Linux)
```

Open **http://127.0.0.1:8080** in a browser. The terminal also prints an address such as
`http://192.168.1.20:8080`: open that on a phone or tablet connected to the same Wi-Fi or router
(the router doesn't need internet). Stop the hub with Ctrl+C.

If Ollama isn't already running in the background, start the Ollama app (or run `ollama serve`).

Options: `--port 8081`, `--host 127.0.0.1` (this computer only, no phones), `--data /path/to/folder`,
`--model llama3.1:8b`, `--ollama http://other-pc:11434` (Ollama on another machine),
`--allow-host NAME` (if you open the hub by a custom host name).

## Use it

- **Home:** emergency reminder, search box, the eight categories, recent guides.
- **Library:** tap *Choose files* (or drag files in) to import. Set each document's category. Bulk import from the
  command line: `python3 hub.py import ~/Downloads/emergency-pdfs --category "First Aid"`.
- **Search:** finds passages by keyword and shows the file name and page. *Open original* opens the real file
  (PDFs open at the page on most desktop browsers; phones may open at page 1, so use *View page text*).
- **Ask:** answers are built from the best-matching passages in your library and cite them as **[1]**, **[2]**.
  Tap a number to see the passage. The app checks the answer:
  - The source list always comes from the search, never from the AI, so it can't invent a source.
  - A cited number with no matching source is shown as a red **?** with a warning.
  - Text in quotation marks that isn't word for word in your documents is flagged as unverified.
  - An answer that cites nothing, or a question with no matching passages, is labelled as unverified general knowledge.
  - Medical, poisoning, wild plant/mushroom, water-safety and gas/electrical questions show a safety note.
  - *Only answer from my documents* stops the AI from adding its own knowledge, and skips the AI when nothing matches.
  - If the AI is unavailable you still get the matching passages to read.
- **Guides:** your own guides and checklists (ticks are saved), plus *Save as guide* from any answer, which keeps
  its sources. The ten starter guides are **templates written for this app, not authoritative sources**. Check them
  against your references and edit or delete them.

## Backup and restore

Everything is in the `data/` folder: `hub.db` (the database) and `files/` (your original documents).

- **Backup:** Settings → *Download backup*, or `python3 hub.py backup my-backup.zip`. It is safe while the hub runs.
  Keep a copy on a USB stick.
- **Restore:** stop the hub, then `python3 hub.py restore my-backup.zip`. Your current data is moved aside to
  `data.before-restore-<date>`, never deleted.
- **Move to another computer:** copy the whole `emergency-hub` folder (including `data/`), or restore a backup there.

## Offline test (do this once, before you need it)

1. Start the hub and Ollama. Import at least one document.
2. **Turn off Wi-Fi and unplug the network cable** (or switch on airplane mode).
3. Restart the computer, then start the hub again with `python3 hub.py`.
4. Check: `python3 hub.py check` shows your documents and "AI: Ready".
5. Open http://127.0.0.1:8080. Search for a word from your document, open the original, and ask a question about it.
   The answer should cite it with a page number.
6. Quit Ollama and ask again. You should see "The AI isn't available" plus the matching passages.
7. For phones: connect the phone and computer to a router with its internet cable unplugged, and open the
   address from the terminal.

What was verified when this was built (in a sandbox with networking removed; see "Testing" below): import,
search, citations, restart, backup/restore, phone layout, AI unavailable, and that the page makes no requests
to anything but the hub. Answers from a **real** Ollama model were **not** tested there (Ollama couldn't be
downloaded in that sandbox), so do step 5 yourself.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Ollama isn't running" | Start the Ollama app, or run `ollama serve` in another terminal. |
| "has no chat model" / "isn't installed" | While online: `ollama pull llama3.2:3b`. Pick the model in Settings. |
| Answers are very slow | Normal on CPU-only computers (the first answer loads the model). Use `llama3.2:1b`, or close other apps. |
| Ollama runs out of memory | Use a smaller model, or start with a smaller context: `HUB_NUM_CTX=4096 python3 hub.py`. |
| Answer ignores the documents or the [1] format | Small models follow instructions loosely. The checks still flag it. Try a larger model (`llama3.1:8b`). |
| A PDF imports with "No searchable text" | It's a scanned image. Run OCR (e.g. `ocrmypdf in.pdf out.pdf`, installed while online) and import the result. |
| Search misses something | It matches words, not meaning. Try other wording, or the exact phrase in "quotes". |
| Phone can't open the address | Same Wi-Fi? Allow Python through the computer's firewall (Windows asks the first time; macOS: System Settings → Network → Firewall). |
| "Couldn't start on port 8080" | It's already running, or something else uses the port: `python3 hub.py --port 8081`. |
| "PDF import needs the pypdf package" | While online: `python3 -m pip install pypdf`. |
| "Unknown host name" | Open it by IP address, or start with `--allow-host yourname`. |

## How it works

One Python program (standard library plus `pypdf`), no build step, no external services.

- `hub/ingest.py` keeps each original file and splits its text into ~900-character passages, recording the
  PDF page (and printed page label) or Markdown section.
- `hub/search.py` uses SQLite's built-in full-text search (FTS5, BM25 ranking, word stemming). No vector database.
- `hub/rag.py` takes the top six passages (at most three per document), numbers them, and sends them with strict
  rules to Ollama's `/api/chat`. Afterwards it checks citation numbers and quotes against those passages, and
  flags high-risk topics.
- `hub/server.py` is a small threaded web server for the JSON API and the static page (`static/`).
- Data: `data/hub.db` (SQLite) and `data/files/`.

Security: there are no accounts. Anyone on your network can open the hub and change the library. Use
`--host 127.0.0.1` if that's a problem. Other websites open in your browser can't change it (custom-header check)
or read it (host check).

## Testing

```bash
python3 -m unittest -v        # 27 tests: ingestion, search, citations, safety notes, HTTP API, restart, backup
```

The tests use a stand-in for Ollama (`tests/fake_ollama.py`) that speaks Ollama's real HTTP API, so they check
the plumbing and the safety checks, not the quality of a real model's answers.

## Known limits

- Keyword search, not semantic: "bleeding" won't find a passage that only says "haemorrhage".
- No OCR for scanned PDFs, and no images or tables from PDFs (open the original for those).
- AI answer quality depends on the model. The checks catch made-up citation numbers and quotes, but not a cited
  passage being misread. That's why every answer links to the passage itself.
