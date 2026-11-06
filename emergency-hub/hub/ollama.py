"""Talk to a local Ollama server (http://127.0.0.1:11434 by default). Standard library only."""
from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request

# Never send local model traffic through a system proxy.
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))


class OllamaError(Exception):
    pass


def is_chat_model(name: str) -> bool:
    return "embed" not in name.lower()


def status(url: str, wanted: str | None = None) -> dict:
    """Is Ollama running, which models are installed, and which one we'll use (with a plain explanation)."""
    out = {"running": False, "models": [], "model": None, "ok": False, "message": ""}
    try:
        with _opener.open(f"{url}/api/tags", timeout=3) as r:
            data = json.load(r)
    except (urllib.error.URLError, ConnectionError, socket.timeout, OSError, ValueError):
        out["message"] = (f"Ollama isn't running (nothing answered at {url}). Start the Ollama app or run "
                          "`ollama serve`. Search, documents and guides still work.")
        return out
    out["running"] = True
    names = [m.get("name") or m.get("model") for m in data.get("models", [])]
    out["models"] = [n for n in names if n and is_chat_model(n)]
    if not out["models"]:
        out["message"] = ("Ollama is running but has no chat model. While you still have internet, run "
                          "`ollama pull llama3.2:3b` (about 2 GB).")
        return out
    if wanted:
        match = next((n for n in out["models"] if n == wanted or n == f"{wanted}:latest"), None)
        if not match:
            out["message"] = (f"The model '{wanted}' isn't installed. Pick an installed one in Settings "
                              f"or run `ollama pull {wanted}` while online.")
            return out
        out["model"] = match
    else:
        out["model"] = out["models"][0]
    out["ok"] = True
    out["message"] = f"Ready: {out['model']}"
    return out


def chat_stream(url: str, model: str, messages: list, timeout: float = 600):
    """Yield pieces of the reply as Ollama writes them."""
    body = json.dumps({
        "model": model, "messages": messages, "stream": True,
        "options": {"temperature": 0.2, "num_ctx": int(os.environ.get("HUB_NUM_CTX", "8192"))},
    }).encode()
    req = urllib.request.Request(f"{url}/api/chat", data=body, headers={"Content-Type": "application/json"})
    try:
        resp = _opener.open(req, timeout=timeout)
    except urllib.error.HTTPError as e:
        try:
            detail = json.load(e).get("error", "")
        except Exception:
            detail = ""
        raise OllamaError(f"Ollama refused the request ({e.code}). {detail}".strip())
    except (urllib.error.URLError, ConnectionError, socket.timeout, OSError) as e:
        raise OllamaError(f"Lost contact with Ollama ({e}). Is it still running?")
    with resp:
        try:
            for line in resp:
                if not line.strip():
                    continue
                msg = json.loads(line)
                if msg.get("error"):
                    raise OllamaError(f"Ollama error: {msg['error']}")
                piece = (msg.get("message") or {}).get("content", "")
                if piece:
                    yield piece
                if msg.get("done"):
                    return
        except (socket.timeout, ConnectionError, OSError) as e:
            raise OllamaError(f"Ollama stopped responding ({e}).")
