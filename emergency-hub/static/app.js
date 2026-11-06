'use strict';
// Emergency Hub front end. Plain JavaScript, no build step, nothing loaded from the internet.

const main = document.getElementById('main');
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const state = { chat: load('hub-chat', []), busy: false, importLog: [] };

function load(key, dflt) { try { return JSON.parse(localStorage.getItem(key)) ?? dflt } catch { return dflt } }
function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* private mode */ } }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.method && opts.method !== 'GET') headers['X-Hub'] = '1';
  if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.json) }
  let r;
  try { r = await fetch(path, { ...opts, headers }) } catch { throw new Error("Couldn't reach the hub. Is it still running on the computer?") }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status}).`);
  return data;
}

// ---------- tiny, safe Markdown (escape first, then format) ----------
function inline(s) {
  return s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function md(src, opts = {}) {
  let html = '', list = null, para = [];
  const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = [] } };
  const closeL = () => { if (list) { html += `</${list}>`; list = null } };
  for (const raw of esc(src).split('\n')) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flushP(); closeL(); continue }
    if (opts.labels) {
      const plain = line.replace(/[*#_:]/g, '').trim().toLowerCase();
      if (plain === 'from your documents') { flushP(); closeL(); html += '<h4 class="lbl-docs">From your documents</h4>'; continue }
      if (/^general knowledge/.test(plain) && plain.length < 60) { flushP(); closeL(); html += '<h4 class="lbl-gen">General knowledge, not from your documents</h4>'; continue }
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushP(); closeL(); const l = Math.min(m[1].length + 1, 4); html += `<h${l}>${inline(m[2])}</h${l}>`; continue }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { flushP(); if (list !== 'ul') { closeL(); html += '<ul>'; list = 'ul' } html += `<li>${inline(m[1])}</li>`; continue }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushP(); if (list !== 'ol') { closeL(); html += '<ol>'; list = 'ol' } html += `<li>${inline(m[1])}</li>`; continue }
    if (/^-{3,}$/.test(line.trim())) { flushP(); closeL(); html += '<hr>'; continue }
    if (list && /^\s{2,}\S/.test(raw)) { html = html.replace(/<\/li>$/, ` ${inline(line.trim())}</li>`); continue }
    closeL(); para.push(line.trim());
  }
  flushP(); closeL();
  return html;
}

// Citation numbers [1] become buttons that jump to the passage; numbers with no matching source are flagged.
function expand(inner) {
  const out = [];
  for (const part of inner.split(/\s*,\s*/)) {
    const b = part.split(/\s*[–-]\s*/).map(Number).filter(Boolean);
    if (b.length === 2 && b[1] > b[0] && b[1] - b[0] < 20) for (let i = b[0]; i <= b[1]; i++) out.push(i);
    else out.push(...b);
  }
  return out;
}
function citeify(html, sources, prefix) {
  const have = new Set(sources.map(s => s.n));
  return html.replace(/\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g, (_, inner) => expand(inner).map(n => have.has(n)
    ? `<button class="cite" data-cite="${prefix}-${n}" title="Show source ${n}">${n}</button>`
    : `<span class="cite bad" title="Not one of the retrieved sources. Ignore this citation.">?${n}</span>`).join(''));
}
// \x02 / \x03 are the highlight markers the search API puts around matching words.
// eslint-disable-next-line no-control-regex
const hl = s => esc(s).replace(/\x02/g, '<mark>').replace(/\x03/g, '</mark>');

document.addEventListener('click', e => {
  const c = e.target.closest('[data-cite]');
  if (!c) return;
  const li = document.getElementById(c.dataset.cite);
  if (li) { li.scrollIntoView({ behavior: 'smooth', block: 'center' }); li.classList.remove('flash'); void li.offsetWidth; li.classList.add('flash') }
});

// ---------- shared bits ----------
function aiPill(st) {
  const o = st.ollama;
  if (o.ok) return `<a class="pill ok" href="#/settings">AI ready · ${esc(o.model)}</a>`;
  return `<a class="pill ${o.running ? 'warn' : 'bad'}" href="#/settings" title="${esc(o.message)}">AI unavailable · library still works</a>`;
}
const ORIGIN = { starter: ['warn', 'Starter template · verify'], chat: ['warn', 'Saved AI answer · verify'], user: ['', 'Your note'] };
function guideLi(g) {
  const done = g.items.filter(i => i.done).length;
  const [cls, label] = ORIGIN[g.origin] || ORIGIN.user;
  return `<li><a href="#/guide/${g.id}"><b>${esc(g.title)}</b></a>
    <div class="row small muted">${g.kind === 'checklist' ? `Checklist · ${done}/${g.items.length} done` : 'Guide'}${g.category ? ` · ${esc(g.category)}` : ''}
    <span class="pill ${cls}">${label}</span></div></li>`;
}
function fmtSize(b) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB` }
function docMeta(d) {
  return [d.kind.toUpperCase(), d.pages ? plural(d.pages, 'page') : null, fmtSize(d.size), d.passages != null ? plural(d.passages, 'passage') : null].filter(Boolean).join(' · ');
}
function srcLinks(s) {
  const view = s.page ? `<a href="#/doc/${s.doc_id}?page=${s.page}">View page text</a>` : `<a href="#/doc/${s.doc_id}">View text</a>`;
  return `<a href="${esc(s.open_url || `/api/documents/${s.doc_id}/file`)}" target="_blank" rel="noopener">Open original</a> ${view}`;
}
const catOptions = (sel, blank = 'No category') =>
  `<option value="">${blank}</option>` + (state.cats || []).map(c => `<option ${c.name === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
async function cats() { if (!state.cats) state.cats = await api('/api/categories'); return state.cats }

// ---------- views: each returns { html, bind } ----------
async function home() {
  const [c, st, gl] = await Promise.all([api('/api/categories'), api('/api/status'), api('/api/guides')]);
  state.cats = c;
  return {
    html: `
    <div class="alert"><b>Life-threatening emergency?</b> Contact your local emergency number first (for example 911, 112 or 999). This app is a reference aid, not medical care.</div>
    <form class="searchbar" id="sf"><input type="search" name="q" placeholder="Search your library and guides…" aria-label="Search"><button class="primary">Search</button></form>
    <div class="row spread"><h2>Categories</h2>${aiPill(st)}</div>
    <div class="tiles">${c.map(x => `<a class="tile" href="#/category/${enc(x.name)}"><span class="ico" aria-hidden="true">${x.icon}</span><b>${esc(x.name)}</b>
      <span class="muted small">${plural(x.guides, 'guide')} · ${plural(x.documents, 'doc')}</span></a>`).join('')}</div>
    ${st.counts.documents === 0 ? `<div class="note info"><b>Your library is empty.</b> <a href="#/library">Import PDF, TXT or Markdown files</a> so answers can cite them. STARTER_RESOURCES.md lists free, reputable documents to download while you're online.</div>` : ''}
    <div class="row"><a class="btn primary" href="#/ask">Ask a question</a><a class="btn" href="#/library">Import documents</a><a class="btn" href="#/guides">Guides and checklists</a></div>
    <div class="card"><div class="row spread"><h2>Recently updated guides</h2><a href="#/guides">All guides</a></div><ul class="list">${gl.slice(0, 5).map(guideLi).join('')}</ul></div>`,
    bind() { $('#sf').onsubmit = e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/search?q=${enc(q)}` } },
  };
}

async function category(name) {
  await cats();
  const cat = state.cats.find(c => c.name === name);
  if (!cat) return { html: '<p>Unknown category. <a href="#/">Home</a></p>' };
  const [docs, gl] = await Promise.all([api(`/api/documents?category=${enc(name)}`), api(`/api/guides?category=${enc(name)}`)]);
  return {
    html: `
    <h1>${cat.icon} ${esc(name)}</h1>
    <form class="searchbar" id="sf"><input type="search" name="q" placeholder="Search ${esc(name)} documents…"><button class="primary">Search</button></form>
    <div class="row"><a class="btn primary" href="#/ask?category=${enc(name)}">Ask about ${esc(name)}</a><a class="btn" href="#/guide/new?category=${enc(name)}">New guide</a><a class="btn" href="#/guide/new?kind=checklist&category=${enc(name)}">New checklist</a></div>
    <div class="card"><h2>Guides and checklists</h2>${gl.length ? `<ul class="list">${gl.map(guideLi).join('')}</ul>` : '<p class="muted">None yet.</p>'}</div>
    <div class="card"><h2>Documents</h2>${docs.length ? `<ul class="list">${docs.map(d => `<li><b>${esc(d.filename)}</b><div class="muted small">${docMeta(d)}</div>
      <div class="row small">${srcLinks({ doc_id: d.id })}</div></li>`).join('')}</ul>`
      : '<p class="muted">No documents in this category. In the <a href="#/library">Library</a>, set a document\'s category.</p>'}</div>`,
    bind() { $('#sf').onsubmit = e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/search?q=${enc(q)}&category=${enc(name)}` } },
  };
}

async function searchView(params) {
  const q = params.get('q') || '', cat = params.get('category') || '';
  const r = q ? await api(`/api/search?q=${enc(q)}${cat ? `&category=${enc(cat)}` : ''}`) : { results: [], guides: [] };
  return {
    html: `
    <form class="searchbar" id="sf"><input type="search" name="q" value="${esc(q)}" placeholder="Search…" aria-label="Search"><button class="primary">Search</button></form>
    ${cat ? `<div class="row small">Only in <span class="pill">${esc(cat)}</span> <a href="#/search?q=${enc(q)}">search everything</a></div>` : ''}
    ${r.guides.length ? `<div class="card"><h2>Guides</h2><ul class="list">${r.guides.map(g => `<li><a href="#/guide/${g.id}"><b>${esc(g.title)}</b></a> <span class="muted small">${g.category ? esc(g.category) : ''}</span></li>`).join('')}</ul></div>` : ''}
    <div class="card"><div class="row spread"><h2>${plural(r.results.length, 'matching passage')}</h2>${q ? `<a class="btn" href="#/ask?q=${enc(q)}">Ask the AI about this</a>` : ''}</div>
    ${r.results.length ? `<ul class="list">${r.results.map(x => `<li><b>${esc(x.filename)}</b> <span class="muted small">${esc(x.where)}</span>
      <div class="passage">${hl(x.snippet)}</div><div class="row small">${srcLinks(x)}</div></li>`).join('')}</ul>`
      : `<p class="muted">${q ? 'Nothing in your documents matches. Try other words, or import more documents.' : 'Type something to search.'}</p>`}</div>`,
    bind() { $('#sf').onsubmit = e => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) location.hash = `#/search?q=${enc(v)}${cat ? `&category=${enc(cat)}` : ''}` } },
  };
}

// ---------- Ask ----------
function renderChecks(c) {
  if (!c) return '';
  let h = '';
  if (c.invalid_citations.length) h += `<div class="note bad">The AI cited source number(s) that don't exist: ${c.invalid_citations.map(x => `[${x}]`).join(' ')}. They're marked with a red ?. Ignore them.</div>`;
  if (c.unverified_quotes.length) h += `<div class="note warn">These quotes were <b>not found word for word</b> in your documents, so treat them as unverified: ${c.unverified_quotes.map(q => `“${esc(q)}”`).join('; ')}</div>`;
  if (c.uncited) h += `<div class="note warn">The AI didn't cite any of your documents. Treat the answer as unverified general knowledge and read the sources below yourself.</div>`;
  else if (c.cited.length && !c.invalid_citations.length) h += `<div class="note ok small">Each cited number matches a passage below. Tap a number to read it and check it says what the answer claims.</div>`;
  return h;
}
function renderMsg(m) {
  const n = m.sources.length, cited = new Set(m.checks?.cited || []);
  let h = `<article class="msg" id="${m.id}"><div class="q">${esc(m.q)}</div>`;
  if (m.cat) h += `<div class="muted small">Searched only ${esc(m.cat)}</div>`;
  for (const r of m.risks) h += `<div class="note bad"><b>${esc(r.label)}:</b> ${esc(r.note)}</div>`;
  if (m.evidence === 'none') h += `<div class="note warn"><b>No matching passages in your library.</b> Anything the AI says here comes from the model's general knowledge, not your documents, and isn't verified.</div>`;
  else if (m.evidence === 'weak') h += `<div class="note warn"><b>Only weak matches found.</b> The passages below may not really answer this, so check them before relying on the answer.</div>`;
  if (m.status === 'searching') h += '<p class="muted">Searching your library…</p>';
  if (m.status === 'unavailable') h += `<div class="note info"><b>The AI isn't available.</b> ${esc(m.notice)}<br>${n ? 'Here are the matching passages from your library. Read them directly:' : 'Try Search on the Home page, or open your guides.'}</div>`;
  if (m.status === 'answering' && !m.answer) h += '<p class="muted">Thinking… On a slow computer the first answer can take a minute or two.</p>';
  if (m.answer) h += `<div class="answer ${m.status === 'answering' ? 'cursor' : ''}">${citeify(md(m.answer, { labels: true }), m.sources, m.id)}</div>`;
  if (m.error) h += `<div class="note bad">${esc(m.error)}</div>`;
  if (m.notice && m.status !== 'unavailable') h += `<div class="note info">${esc(m.notice)}</div>`;
  h += renderChecks(m.checks);
  if (n) h += `<h3 style="margin-top:1rem">Sources from your library</h3><ol class="sources">${m.sources.map(s => `<li id="${m.id}-${s.n}">
    <span class="num">[${s.n}]</span> <b>${esc(s.filename)}</b>${s.where ? ` · ${esc(s.where)}` : ''} ${m.checks && !cited.has(s.n) && m.answer ? '<span class="pill">not cited</span>' : ''}
    <details ${m.status === 'unavailable' ? 'open' : ''}><summary>Show passage</summary><div class="passage">${esc(s.text)}</div></details>
    <div class="row small">${srcLinks(s)}</div></li>`).join('')}</ol>`;
  if (m.status === 'done' && m.answer) h += `<div class="row no-print" style="margin-top:.75rem"><button data-save="${m.id}">Save as guide</button>${m.model ? `<span class="muted small">Answered by ${esc(m.model)}</span>` : ''}</div>`;
  return h + '</article>';
}
let paintQueued = new Set();
function updateMsg(m) {
  if (paintQueued.has(m)) return;
  paintQueued.add(m);
  requestAnimationFrame(() => {
    paintQueued.delete(m);
    const el = document.getElementById(m.id);
    if (!el) return;
    const nearBottom = window.innerHeight + window.scrollY > document.body.scrollHeight - 160;
    const open = [...el.querySelectorAll('details[open]')].map(d => d.parentElement.id);
    el.outerHTML = renderMsg(m);
    open.forEach(id => { const d = document.getElementById(id)?.querySelector('details'); if (d) d.open = true });
    if (nearBottom) window.scrollTo(0, document.body.scrollHeight);
  });
}

async function sendQuestion(q, cat) {
  if (state.busy) return;
  state.busy = true;
  const history = state.chat.filter(m => m.status === 'done' && m.answer).slice(-2)
    .flatMap(m => [{ role: 'user', content: m.q }, { role: 'assistant', content: m.answer }]);
  const m = { id: `m${Date.now()}`, q, cat, sources: [], risks: [], evidence: null, answer: '', status: 'searching' };
  state.chat.push(m);
  $('#intro')?.remove();
  $('#msgs')?.insertAdjacentHTML('beforeend', renderMsg(m));
  window.scrollTo(0, document.body.scrollHeight);
  const handle = ev => {
    if (ev.type === 'sources') Object.assign(m, { sources: ev.sources, evidence: ev.evidence, risks: ev.risks, status: 'answering' });
    else if (ev.type === 'token') m.answer += ev.text;
    else if (ev.type === 'unavailable') Object.assign(m, { status: 'unavailable', notice: ev.message });
    else if (ev.type === 'error') m.error = ev.message;
    else if (ev.type === 'done') { m.checks = ev.checks; m.model = ev.model; if (ev.notice) m.notice = ev.notice; if (m.status !== 'unavailable') m.status = 'done' }
    updateMsg(m);
  };
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub': '1' },
      body: JSON.stringify({ question: q, history, category: cat || null, strict: load('hub-strict', false) }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `Request failed (${res.status}).`) }
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) handle(JSON.parse(line)) }
    }
  } catch (e) {
    m.error = e instanceof TypeError ? "Lost contact with the hub. Is it still running on the computer?" : e.message;
  } finally {
    if (m.status === 'searching' || m.status === 'answering') m.status = m.answer ? 'done' : 'failed';
    state.busy = false;
    updateMsg(m);
    store('hub-chat', state.chat.slice(-30));
    const b = $('#send'); if (b) b.disabled = false;
  }
}

async function saveAsGuide(id) {
  const m = state.chat.find(x => x.id === id);
  if (!m) return;
  const cited = new Set(m.checks?.cited || []);
  const sources = m.sources.filter(s => cited.has(s.n)).map(({ n, doc_id, filename, page, page_label, section, where }) => ({ n, doc_id, filename, page, page_label, section, where }));
  const body = `*Saved from an AI answer on ${new Date().toLocaleDateString()}. AI text can be wrong. Check it against the sources listed below.*\n\n**Question:** ${m.q}\n\n${m.answer}`;
  const g = await api('/api/guides', { method: 'POST', json: { title: m.q.slice(0, 120), category: m.cat || null, kind: 'guide', body, sources, origin: 'chat' } });
  toast('Saved. Pick a category and tidy the title.');
  location.hash = `#/guide/${g.id}/edit`;
}

async function ask(params) {
  const st = await api('/api/status');
  const cat = params.get('category') || '';
  return {
    noScroll: true,
    html: `
    <div class="row spread"><h1>Ask</h1>${aiPill(st)}</div>
    <div class="row small"><label class="row"><input type="checkbox" id="strict" ${load('hub-strict', false) ? 'checked' : ''}> Only answer from my documents</label>
      ${cat ? `<span class="pill">Searching only ${esc(cat)} · <a href="#/ask">all</a></span>` : ''}
      ${state.chat.length ? '<button class="link" id="clear">Clear conversation</button>' : ''}</div>
    ${state.chat.length ? '' : `<div class="note info" id="intro">Answers are built from passages found in <b>your library</b> and cite them like <b>[1]</b>: tap a number to read the passage, and open the original document to check it.
      Anything under <b>General knowledge</b> comes from the AI model itself and isn't verified. The AI can be wrong, so for medical, poisoning, water and wild-food questions, rely on the cited sources and qualified help.</div>`}
    <div id="msgs" class="stack">${state.chat.map(renderMsg).join('')}</div>
    <form class="composer row" id="cf"><textarea class="grow" name="q" placeholder="e.g. How do I make water safe to drink?" aria-label="Your question" required></textarea>
      <button class="primary" id="send">Ask</button></form>`,
    bind() {
      const f = $('#cf');
      f.q.value = params.get('q') || '';
      f.onsubmit = e => {
        e.preventDefault();
        const q = f.q.value.trim();
        if (!q || state.busy) return;
        f.q.value = ''; $('#send').disabled = true;
        sendQuestion(q, cat);
      };
      f.q.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit() } };
      $('#strict').onchange = e => store('hub-strict', e.target.checked);
      const c = $('#clear'); if (c) c.onclick = () => { if (state.busy) return; state.chat = []; store('hub-chat', []); render() };
      $('#msgs').onclick = e => { const b = e.target.closest('[data-save]'); if (b) saveAsGuide(b.dataset.save).catch(err => toast(err.message)) };
      window.scrollTo(0, document.body.scrollHeight);
      if (params.get('q') && !state.busy) f.q.focus();
    },
  };
}

// ---------- Library ----------
async function importFiles(files, category) {
  for (const file of files) {
    const entry = { name: file.name, text: 'Importing…', cls: 'info' };
    state.importLog.unshift(entry);
    paintLog();
    try {
      const r = await api(`/api/documents?filename=${enc(file.name)}${category ? `&category=${enc(category)}` : ''}`,
        { method: 'POST', body: file, headers: { 'Content-Type': 'application/octet-stream' } });
      Object.assign(entry, r.duplicate ? { text: 'Already in your library.', cls: 'info' }
        : { text: `Imported: ${plural(r.passages, 'searchable passage')}${r.warnings.length ? `. ${r.warnings.join(' ')}` : '.'}`, cls: r.warnings.length ? 'warn' : 'ok' });
    } catch (e) { Object.assign(entry, { text: e.message, cls: 'bad' }) }
    paintLog();
  }
  render();
}
function paintLog() {
  const el = $('#implog');
  if (el) el.innerHTML = state.importLog.slice(0, 20).map(x => `<div class="note ${x.cls} small"><b>${esc(x.name)}</b>: ${esc(x.text)}</div>`).join('');
}

async function library() {
  const [docs, st] = await Promise.all([api('/api/documents'), api('/api/status'), cats()]);
  return {
    html: `
    <h1>Library</h1>
    <div class="card stack">
      <h2>Import documents</h2>
      ${st.pdf_support ? '' : '<div class="note warn">PDF import is off because the pypdf package is missing. While online, run <code>pip install pypdf</code> and restart.</div>'}
      <label class="field"><span>Category for new files (optional)</span><select id="impcat">${catOptions(load('hub-impcat', ''))}</select></label>
      <div class="dropzone" id="drop"><p>Drop PDF, TXT or Markdown files here, or</p>
        <label class="btn primary">Choose files<input type="file" id="file" multiple accept=".pdf,.txt,.md,.markdown" hidden></label>
        <p class="muted small" style="margin-top:.5rem">Files stay on this computer. Only import documents you have the right to keep.</p></div>
      <div id="implog" class="stack"></div>
    </div>
    <form class="searchbar" id="sf"><input type="search" name="q" placeholder="Search all documents…"><button class="primary">Search</button></form>
    <div class="card"><h2>${plural(docs.length, 'document')}</h2>
    ${docs.length ? `<ul class="list">${docs.map(d => `<li>
      <div class="row spread"><div class="grow"><b>${esc(d.filename)}</b><div class="muted small">${docMeta(d)}</div></div>
        <select data-cat="${d.id}" aria-label="Category" style="width:auto">${catOptions(d.category)}</select></div>
      ${d.chars === 0 ? '<div class="note warn small">No searchable text. If it\'s a scanned PDF, OCR it and import that copy.</div>' : ''}
      <div class="row small" style="margin-top:.35rem">${srcLinks({ doc_id: d.id })}<a href="/api/documents/${d.id}/file?download=1">Download</a>
        <button class="link danger" data-del="${d.id}" data-name="${esc(d.filename)}">Delete</button></div></li>`).join('')}</ul>`
      : '<p class="muted">Nothing imported yet.</p>'}</div>`,
    bind() {
      paintLog();
      const catSel = $('#impcat');
      catSel.onchange = () => store('hub-impcat', catSel.value);
      $('#file').onchange = e => { const files = [...e.target.files]; e.target.value = ''; importFiles(files, catSel.value) };
      const drop = $('#drop');
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over') };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); importFiles([...e.dataTransfer.files], catSel.value) };
      $('#sf').onsubmit = e => { e.preventDefault(); const q = e.target.q.value.trim(); if (q) location.hash = `#/search?q=${enc(q)}` };
      main.querySelectorAll('[data-cat]').forEach(s => s.onchange = async () => {
        try { await api(`/api/documents/${s.dataset.cat}`, { method: 'PUT', json: { category: s.value || null } }); state.cats = null; toast('Category saved.') }
        catch (e) { toast(e.message) }
      });
      main.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        if (!confirm(`Delete “${b.dataset.name}” from the library? The original file in the data folder is deleted too.`)) return;
        try { await api(`/api/documents/${b.dataset.del}`, { method: 'DELETE' }); state.cats = null; toast('Deleted.'); render() } catch (e) { toast(e.message) }
      });
    },
  };
}

async function docText(id, params) {
  const page = Number(params.get('page')) || null;
  const r = await api(`/api/documents/${id}/text${page ? `?page=${page}` : ''}`);
  const d = r.document;
  const nav = d.kind === 'pdf' && page ? `<div class="row">
      ${page > 1 ? `<a class="btn" href="#/doc/${id}?page=${page - 1}">‹ Page ${page - 1}</a>` : ''}
      <span class="muted">PDF page ${page} of ${d.pages}</span>
      ${page < d.pages ? `<a class="btn" href="#/doc/${id}?page=${page + 1}">Page ${page + 1} ›</a>` : ''}</div>` : '';
  const label = r.passages[0]?.page_label;
  return {
    html: `
    <div><a href="#/library">‹ Library</a></div>
    <div class="card stack"><h1>${esc(d.title)}</h1><div class="muted small">${esc(d.filename)} · ${docMeta(d)}${label && String(label) !== String(page) ? ` · printed page ${esc(label)}` : ''}</div>
      <div class="row small"><a href="/api/documents/${d.id}/file${page ? `#page=${page}` : ''}" target="_blank" rel="noopener">Open original</a>
        <a href="/api/documents/${d.id}/file?download=1">Download</a>${page ? `<a href="#/doc/${id}">Whole document text</a>` : ''}</div>
      <div class="note info small">This is the text the app extracted for searching. Layout, tables and images are only in the original.</div>
      ${nav}
      ${r.passages.length ? r.passages.map(p => `${p.section && !page ? `<div class="muted small">${esc(p.section)}</div>` : ''}${!page && p.page ? `<div class="muted small">Page ${p.page}</div>` : ''}<div class="passage">${esc(p.text)}</div>`).join('')
        : '<p class="muted">No text was extracted here.</p>'}
      ${nav}</div>`,
  };
}

// ---------- Guides ----------
async function guides(params) {
  await cats();
  const cat = params.get('category') || '';
  const gl = await api(`/api/guides${cat ? `?category=${enc(cat)}` : ''}`);
  const groups = {};
  for (const g of gl) (groups[g.category || 'No category'] ||= []).push(g);
  const order = [...state.cats.map(c => c.name), 'No category'].filter(k => groups[k]);
  return {
    html: `
    <div class="row spread"><h1>Guides and checklists</h1>
      <div class="row"><a class="btn primary" href="#/guide/new">New guide</a><a class="btn" href="#/guide/new?kind=checklist">New checklist</a></div></div>
    <label class="field" style="max-width:20rem"><span>Show</span><select id="gcat">${catOptions(cat, 'All categories')}</select></label>
    ${order.length ? order.map(k => `<div class="card"><h2>${esc(k)}</h2><ul class="list">${groups[k].map(guideLi).join('')}</ul></div>`).join('') : '<p class="muted">No guides here yet.</p>'}`,
    bind() { $('#gcat').onchange = e => { location.hash = `#/guides${e.target.value ? `?category=${enc(e.target.value)}` : ''}` } },
  };
}

async function guide(id) {
  const g = await api(`/api/guides/${id}`);
  const [cls, label] = ORIGIN[g.origin] || ORIGIN.user;
  const done = g.items.filter(i => i.done).length;
  const srcs = g.sources.map(s => ({ ...s, n: s.n ?? 0 }));
  const prefix = `g${g.id}`;
  return {
    html: `
    <div class="no-print"><a href="#/guides">‹ Guides</a></div>
    <div class="card stack">
      <h1>${esc(g.title)}</h1>
      <div class="row small">${g.category ? `<span class="pill">${esc(g.category)}</span>` : ''}<span class="pill ${cls}">${label}</span><span class="muted">Updated ${esc(g.updated_at.replace('T', ' ').slice(0, 16))}</span></div>
      ${g.body ? `<div class="md answer">${citeify(md(g.body, { labels: true }), srcs, prefix)}</div>` : ''}
      ${g.kind === 'checklist' ? `<div><div class="row spread"><b>${done} of ${g.items.length} done</b><button class="link no-print" id="uncheck">Uncheck all</button></div>
        ${g.items.map((it, i) => `<label class="check ${it.done ? 'done' : ''}"><input type="checkbox" data-i="${i}" ${it.done ? 'checked' : ''}><span>${esc(it.text)}</span></label>`).join('')}</div>` : ''}
      ${srcs.length ? `<div><h3>Sources</h3><ol class="sources">${srcs.map(s => `<li id="${prefix}-${s.n}"><span class="num">[${s.n}]</span> <b>${esc(s.filename)}</b>${s.where ? ` · ${esc(s.where)}` : ''}
        ${s.missing ? '<div class="note warn small">This document is no longer in the library.</div>'
          : `<div class="row small">${srcLinks({ ...s, open_url: `/api/documents/${s.doc_id}/file${s.page ? `#page=${s.page}` : ''}` })}</div>`}</li>`).join('')}</ol></div>` : ''}
      <div class="row no-print"><a class="btn" href="#/guide/${g.id}/edit">Edit</a><button id="print">Print</button><button class="danger" id="del">Delete</button></div>
    </div>`,
    bind() {
      const save = async items => {
        try { await api(`/api/guides/${g.id}`, { method: 'PUT', json: { items } }); g.items = items; render(true) } catch (e) { toast(e.message) }
      };
      main.querySelectorAll('[data-i]').forEach(cb => cb.onchange = () => save(g.items.map((it, i) => i === Number(cb.dataset.i) ? { ...it, done: cb.checked } : it)));
      const u = $('#uncheck'); if (u) u.onclick = () => save(g.items.map(it => ({ ...it, done: false })));
      $('#print').onclick = () => window.print();
      $('#del').onclick = async () => {
        if (!confirm(`Delete “${g.title}”?`)) return;
        try { await api(`/api/guides/${g.id}`, { method: 'DELETE' }); state.cats = null; toast('Deleted.'); location.hash = '#/guides' } catch (e) { toast(e.message) }
      };
    },
  };
}

async function guideEdit(id, params) {
  await cats();
  const g = id ? await api(`/api/guides/${id}`)
    : { title: '', category: params.get('category') || '', kind: params.get('kind') === 'checklist' ? 'checklist' : 'guide', body: '', items: [] };
  const itemsText = g.items.map(i => (i.done ? '[x] ' : '') + i.text).join('\n');
  return {
    html: `
    <div><a href="${id ? `#/guide/${id}` : '#/guides'}">‹ Cancel</a></div>
    <form class="card stack" id="gf">
      <h1>${id ? 'Edit' : 'New'} ${g.kind === 'checklist' ? 'checklist' : 'guide'}</h1>
      <label class="field"><span>Title</span><input type="text" name="title" value="${esc(g.title)}" required maxlength="200"></label>
      <div class="row"><label class="field grow"><span>Category</span><select name="category">${catOptions(g.category)}</select></label>
        <label class="field grow"><span>Type</span><select name="kind"><option value="guide">Guide</option><option value="checklist" ${g.kind === 'checklist' ? 'selected' : ''}>Checklist</option></select></label></div>
      <label class="field"><span>Text (simple formatting: # heading, - bullet, **bold**)</span><textarea name="body" rows="10">${esc(g.body)}</textarea></label>
      <label class="field" id="itemsf"><span>Checklist items, one per line (start a line with [x] to mark it done)</span><textarea name="items" rows="8">${esc(itemsText)}</textarea></label>
      <div class="row"><button class="primary">Save</button></div>
    </form>`,
    bind() {
      const f = $('#gf');
      const sync = () => { $('#itemsf').style.display = f.kind.value === 'checklist' ? '' : 'none' };
      f.kind.onchange = sync; sync();
      f.onsubmit = async e => {
        e.preventDefault();
        const items = f.items.value.split('\n').map(l => l.trim()).filter(Boolean)
          .map(l => /^\[x\]\s*/i.test(l) ? { text: l.replace(/^\[x\]\s*/i, ''), done: true } : { text: l.replace(/^\[\s?\]\s*/, ''), done: false });
        const json = { title: f.title.value, category: f.category.value || null, kind: f.kind.value, body: f.body.value, items };
        try {
          const saved = await api(id ? `/api/guides/${id}` : '/api/guides', { method: id ? 'PUT' : 'POST', json });
          state.cats = null; toast('Saved.'); location.hash = `#/guide/${saved.id}`;
        } catch (err) { toast(err.message) }
      };
    },
  };
}

// ---------- Settings ----------
async function settings() {
  const st = await api('/api/status?lan=1');
  const o = st.ollama;
  return {
    html: `
    <h1>Settings</h1>
    <div class="card stack"><div class="row spread"><h2>AI model (Ollama)</h2>${aiPill(st)}</div>
      <div class="note ${o.ok ? 'ok' : 'warn'}">${esc(o.message)}</div>
      ${o.models.length ? `<label class="field"><span>Model to use</span><select id="model">
        <option value="">Automatic (first installed)</option>${o.models.map(m => `<option ${m === st.wanted_model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>` : ''}
      <p class="small muted">Ollama address: ${esc(st.ollama_url)}. Without the AI you can still search, read documents and use guides.
        To add a model while you have internet: <code>ollama pull llama3.2:3b</code> (needs about 4 GB of free memory) or <code>ollama pull llama3.2:1b</code> for older computers.</p>
      <div class="row"><button id="recheck">Check again</button></div></div>
    <div class="card stack"><h2>Use it on a phone or tablet</h2>
      ${st.lan_urls?.length ? `<p>On a device connected to the same Wi-Fi, open:</p>${st.lan_urls.map(u => `<p><b>${esc(u)}</b></p>`).join('')}
        <p class="small muted">Anyone on this network can open the hub. If the address doesn't work, your computer's firewall may be blocking it (see README).</p>`
        : '<p class="muted">No network address found. Connect this computer to Wi-Fi or a router (internet isn\'t needed).</p>'}</div>
    <div class="card stack"><h2>Your data</h2>
      <p>${plural(st.counts.documents, 'document')} · ${plural(st.counts.passages, 'searchable passage')} · ${plural(st.counts.guides, 'guide')}</p>
      <p class="small muted">Stored in <code>${esc(st.data_dir)}</code>: the database (hub.db) and your original files (files/).</p>
      <div class="row"><a class="btn primary" href="/api/backup">Download backup (.zip)</a></div>
      <p class="small muted">To restore, stop the hub, then run <code>python hub.py restore your-backup.zip</code>. Your current data is moved aside, not deleted.</p></div>
    <div class="card stack"><h2>About and safety</h2>
      <p>This hub runs entirely on this computer. The page loads nothing from the internet (no fonts, scripts or analytics), and the AI runs locally in Ollama.</p>
      <p>It is a <b>reference aid</b>, not a substitute for emergency services, a doctor or other qualified help. AI answers can be wrong: check the cited passages in the original documents, especially for medical, poisoning, water-safety and wild-food questions. Never eat a wild plant or mushroom because an app or AI identified it.</p>
      <p class="small muted">Version ${esc(st.version)}</p></div>`,
    bind() {
      const m = $('#model');
      if (m) m.onchange = async () => { try { await api('/api/settings', { method: 'PUT', json: { model: m.value } }); toast('Model saved.'); render() } catch (e) { toast(e.message) } };
      $('#recheck').onclick = () => render();
    },
  };
}

// ---------- router ----------
const routes = [
  [/^\/$/, home], [/^\/ask$/, (p) => ask(p)], [/^\/library$/, library], [/^\/search$/, (p) => searchView(p)],
  [/^\/category\/(.+)$/, category], [/^\/guides$/, (p) => guides(p)], [/^\/guide\/new$/, (p) => guideEdit(null, p)],
  [/^\/guide\/(\d+)$/, guide], [/^\/guide\/(\d+)\/edit$/, (id, p) => guideEdit(id, p)], [/^\/doc\/(\d+)$/, docText], [/^\/settings$/, settings],
];
const TAB = { search: 'home', category: 'home', guide: 'guides', doc: 'library' };
let renderId = 0;
async function render(keepScroll = false) {
  const id = ++renderId;
  const hash = location.hash.slice(1) || '/';
  const [path, query = ''] = hash.split('?');
  const params = new URLSearchParams(query);
  const tab = path.split('/')[1] || 'home';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (TAB[tab] || tab)));
  const route = routes.find(([rx]) => rx.test(path));
  let view;
  try {
    if (!route) view = { html: '<p>Page not found. <a href="#/">Go home</a></p>' };
    else view = await route[1](...path.match(route[0]).slice(1).map(decodeURIComponent), params);
  } catch (e) { view = { html: `<div class="note bad">${esc(e.message)}</div><p><a href="#/">Go home</a></p>` } }
  if (id !== renderId) return; // a newer page was opened meanwhile
  main.innerHTML = view.html;
  if (!view.noScroll && !keepScroll) window.scrollTo(0, 0);
  view.bind?.();
}
window.addEventListener('hashchange', () => render());
render();
