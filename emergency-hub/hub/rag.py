"""Grounding: build the prompt from retrieved passages, then check the answer's citations and quotes.

The source list shown to the user always comes from the search results, never from the model,
so a model can't add a source that doesn't exist. Citation numbers and quotes the model writes
are checked against those passages and flagged when they don't match.
"""
from __future__ import annotations

import re

from .search import place

RISKS = [
    ("medical", "Medical",
     r"\b(bleed\w*|blood|burns?|cpr|chok\w*|overdos\w*|doses?|dosage\w*|dosing|medic\w*|drugs?|pills?|tablets?|mg|fractur\w*|"
     r"broken bones?|seizur\w*|strokes?|heart attack|chest pain|allerg\w*|anaphyla\w*|epipen|infect\w*|wounds?|"
     r"hypotherm\w*|heat ?stroke|frostbite|unconscious|not breathing|pregnan\w*|insulin|antibiotic\w*|fever|"
     r"infants?|bab(y|ies)|snake ?bites?|bites?|stings?|tourniquet\w*|concussion)\b",
     "If someone is hurt or ill, contact emergency services if at all possible. This app is a reference aid, "
     "not medical care. Don't take medication doses from AI text; use a qualified professional or the dose "
     "printed in an authoritative source."),
    ("poison", "Poisoning",
     r"\b(poison\w*|toxic\w*|toxin\w*|swallow\w*|ingest\w*|carbon monoxide|fumes?|chemicals?|antifreeze|lye)\b",
     "Suspected poisoning: contact emergency services or poison control now (US Poison Help: 1-800-222-1222)."),
    ("wild", "Wild plants and mushrooms",
     r"\b(mushroom\w*|fung(i|us)|forag\w*|edible|berr(y|ies)|wild plants?|toadstools?|hemlock|nightshade)\b",
     "Never eat a wild plant or mushroom based on an app, a photo or AI identification. Deadly species look "
     "like edible ones. Only eat what a local expert has identified in person."),
    ("water", "Water safety",
     r"\b(contaminat\w*|purif\w*|disinfect\w*|boil(ing)? water|bleach|drinking water|safe to drink|potable|"
     r"well water|giardia|cholera|chlorin\w*|flood ?water|sewage)\b",
     "For water treatment, follow the exact amounts and times in an authoritative guide (for example CDC or WHO)."),
    ("hazard", "Gas, electrical and fire hazards",
     r"\b(generators?|gas leak|smell gas|propane|natural gas|downed (power )?lines?|power lines?|electrocut\w*|"
     r"wildfire|house fire|space heaters?|chainsaw\w*)\b",
     "Gas, carbon monoxide and electrical hazards can kill quickly. If you smell gas or a CO alarm sounds, get "
     "everyone outside first. Run generators outdoors only, far from windows and doors."),
]


def risks(text: str) -> list:
    t = text.lower()
    return [{"key": k, "label": label, "note": note} for k, label, rx, note in RISKS if re.search(rx, t)]


SYSTEM = """You are an offline emergency reference assistant. People may use you when they cannot reach the internet or emergency services.

How to answer:
1. The numbered SOURCES are passages from the user's own document library. Base your answer on them first.
2. Cite every statement that comes from a source with its number in square brackets right after it, like [1] or [2][3]. Only use numbers that appear in SOURCES. Never invent a source, title, page number or quotation. Only put words in quotation marks if they are copied exactly from a source.
3. Write your answer in two labelled parts:
From your documents:
(only what the sources support, every point cited)
General knowledge (not from your documents):
(anything you add from your own knowledge, with no citations; leave this part out if you have nothing useful to add)
4. If the sources don't answer the question, say "Your documents don't cover this." first. Do not stretch a source to fit.
5. Never give medication names with doses, or other treatment amounts, unless the exact figure appears in a source; if it does, quote it and cite it.
6. Never say a wild plant, berry or mushroom is safe to eat.
7. If the situation could be life-threatening, say first to contact emergency services if possible.
8. Be brief and practical: short steps or bullet points. Plain language."""

STRICT = """
The user asked for answers ONLY from their documents: leave out the "General knowledge" part entirely."""

NO_SOURCES = """
No passages in the user's library matched this question. Start with "Your documents don't cover this." Then, unless this is a medical, poisoning, wild food or water-safety question, you may give brief general guidance under "General knowledge (not from your documents):". For those high-risk topics give only basic safety direction (such as contacting emergency services or poison control), no detailed treatment steps or amounts."""

RISK_EXTRA = """
This question touches a high-risk topic ({labels}). Be extra careful: stick to the sources, no doses or amounts that aren't in a source, and include the safety advice that applies."""

MAX_SOURCE_CHARS = 1200
MAX_HISTORY = 4


def source_label(n: int, s: dict) -> str:
    where = place(s)
    return f"[{n}] {s['filename']}" + (f", {where}" if where else "")


def build_messages(question: str, sources: list, history: list, risk_list: list, strict: bool = False) -> list:
    system = SYSTEM
    if strict:
        system += STRICT
    if not sources:
        system += NO_SOURCES
    if risk_list:
        system += RISK_EXTRA.format(labels=", ".join(r["label"] for r in risk_list))
    msgs = [{"role": "system", "content": system}]
    for h in (history or [])[-MAX_HISTORY:]:
        if h.get("role") in ("user", "assistant") and isinstance(h.get("content"), str):
            msgs.append({"role": h["role"], "content": h["content"][:1500]})
    if sources:
        block = "\n\n".join(f"{source_label(i, s)}\n{s['text'][:MAX_SOURCE_CHARS]}" for i, s in enumerate(sources, 1))
        content = f"SOURCES:\n\n{block}\n\nQUESTION: {question}"
    else:
        content = f"SOURCES: none matched.\n\nQUESTION: {question}"
    msgs.append({"role": "user", "content": content})
    return msgs


CITE = re.compile(r"\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]")
QUOTE = re.compile(r"[\"“]([^\"“”\n]{15,500})[\"”]")


def cited_numbers(answer: str) -> list:
    nums = []
    for m in CITE.finditer(answer):
        for part in re.split(r"\s*,\s*", m.group(1)):
            bounds = [int(x) for x in re.split(r"\s*[–-]\s*", part) if x]
            if len(bounds) == 2 and 0 < bounds[1] - bounds[0] < 20:
                nums.extend(range(bounds[0], bounds[1] + 1))
            else:
                nums.extend(bounds)
    return nums


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", s.lower())).strip()


def verify(answer: str, sources: list) -> dict:
    n = len(sources)
    nums = cited_numbers(answer)
    valid = sorted({x for x in nums if 1 <= x <= n})
    invalid = sorted({x for x in nums if not 1 <= x <= n})
    corpus = " ".join(norm(s["text"]) for s in sources)
    unverified = [q.strip() for q in QUOTE.findall(answer) if norm(q) and norm(q) not in corpus]
    return {
        "cited": valid,
        "invalid_citations": invalid,
        "unverified_quotes": unverified[:10],
        "uncited": bool(sources) and bool(answer.strip()) and not valid,
    }


def public_source(n: int, s: dict) -> dict:
    url = f"/api/documents/{s['doc_id']}/file"
    if s.get("kind") == "pdf" and s.get("page"):
        url += f"#page={s['page']}"
    return {
        "n": n, "doc_id": s["doc_id"], "filename": s["filename"], "title": s["title"], "kind": s["kind"],
        "page": s.get("page"), "page_label": s.get("page_label"), "section": s.get("section"),
        "where": place(s), "text": s["text"], "open_url": url,
    }
