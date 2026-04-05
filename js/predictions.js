/* ─── Swimulation — Predictions Engine ───────────────────────────────────────
 * Allows users to submit predicted finish orders per event, then score them
 * against actual results entered after the meet.
 * Persistence: localStorage  |  No external dependencies.
 * ─────────────────────────────────────────────────────────────────────────── */
'use strict';

/* ── App state ───────────────────────────────────────────────────────────────── */
const pState = {
  comp:   'World Aquatics Championships',
  gender: 'W',
  cat:    'Freestyle',
  dist:   100,
  mode:   'pick',   // 'pick' | 'saved'
};

let predictionOrder = [];   // current drag list (array of athlete names)
let dragSrcEl       = null; // active drag source element

/* ── Data loading ─────────────────────────────────────────────────────────── */
function loadAthletes() {
  return fetch('js/data/athletes.json')
    .then(r => r.json())
    .then(d => { window.ATHLETES = d.events; })
    .catch(() => console.warn('Using inline athlete data'));
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function eventKey()   { return `${pState.gender}-${CAT_ABBR[pState.cat]}-${pState.dist}`; }
function storageKey() { return `pick:${pState.comp}:${eventKey()}`; }

function eventLabel() {
  const g = pState.gender === 'W' ? "Women's" : "Men's";
  const s = pState.cat === 'IM' ? 'Individual Medley' : pState.cat;
  return `${g} ${pState.dist}m ${s}`;
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '—';
  if (s < 60) return s.toFixed(2);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
}

function getEligibleAthletes() {
  const eligible = (typeof COMP_ELIGIBILITY !== 'undefined') ? COMP_ELIGIBILITY[pState.comp] : null;
  return (ATHLETES[eventKey()] || []).filter(a =>
    a.active !== false && (!eligible || eligible.has(a.country))
  );
}

/* ── localStorage helpers ─────────────────────────────────────────────────── */
function savePickToStorage() {
  const rec = {
    comp:        pState.comp,
    event:       eventKey(),
    eventLabel:  eventLabel(),
    savedAt:     Date.now(),
    predictions: predictionOrder.slice(),
    results:     (loadPickFromStorage() || {}).results || null,
    scored:      null,
  };
  localStorage.setItem(storageKey(), JSON.stringify(rec));
}

function loadPickFromStorage() {
  const raw = localStorage.getItem(storageKey());
  return raw ? JSON.parse(raw) : null;
}

function saveResultsToStorage(names) {
  const rec = loadPickFromStorage();
  if (!rec) return;
  rec.results = names;
  rec.scored  = scorePick(rec.predictions, names);
  localStorage.setItem(storageKey(), JSON.stringify(rec));
}

function getAllSavedPicks() {
  const picks = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('pick:')) {
      try { picks.push(JSON.parse(localStorage.getItem(k))); } catch {}
    }
  }
  picks.sort((a, b) => b.savedAt - a.savedAt);
  return picks;
}

function deletePick(key) {
  localStorage.removeItem(key);
  renderSavedTab();
}

/* ── Scoring ─────────────────────────────────────────────────────────────── */
/*
 * Points per position compared to actual:
 *   Exact position  → 3 pts (+ 2 bonus for gold, +1 for silver/bronze)
 *   Off by 1        → 1 pt
 *   Off by 2+       → 0 pts
 * Maximum: 8 × 3 + 3 (gold) + 2 + 1 = 30 pts
 */
function scorePick(predicted, actual) {
  const maxPos = Math.min(predicted.length, actual.length, 8);
  let total = 0, max = 0;
  const breakdown = [];

  for (let actualPos = 0; actualPos < maxPos; actualPos++) {
    const athlete  = actual[actualPos];
    const predPos  = predicted.indexOf(athlete);
    const posBonus = actualPos === 0 ? 2 : actualPos <= 2 ? 1 : 0; // gold/silver/bronze bonus
    const posMax   = 3 + posBonus;
    max += posMax;

    let pts = 0, note = '';
    if (predPos === actualPos)      { pts = 3 + posBonus; note = '✓ exact'; }
    else if (Math.abs(predPos - actualPos) === 1) { pts = 1; note = '≈ close'; }
    else if (predPos === -1)        { pts = 0; note = '✗ not picked'; }
    else                            { pts = 0; note = `✗ picked #${predPos + 1}`; }

    total += pts;
    breakdown.push({ pos: actualPos + 1, athlete, pts, posMax, note });
  }

  const pct = max > 0 ? Math.round(total / max * 100) : 0;
  return { total, max, pct, breakdown };
}

/* ── Controls ─────────────────────────────────────────────────────────────── */
function pSetGender(g) {
  pState.gender = g;
  document.querySelectorAll('.gender-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.gender === g));
  pUpdateDistBtns();
  refreshPickList();
}
function pSetCat(c) {
  pState.cat = c;
  document.querySelectorAll('.cat-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === c));
  const dists = EVENTS[c] || [];
  if (!dists.includes(pState.dist)) pState.dist = dists[0];
  pUpdateDistBtns();
  refreshPickList();
}
function pSetDist(d) {
  pState.dist = d;
  document.querySelectorAll('.dist-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.dist) === d));
  refreshPickList();
}
function pSetComp(val) {
  pState.comp = val;
  refreshPickList();
}
function pUpdateDistBtns() {
  const dists = EVENTS[pState.cat] || [];
  if (!dists.includes(pState.dist)) pState.dist = dists[0];
  document.getElementById('pDistBtns').innerHTML = dists.map(d =>
    `<button class="dist-btn${d === pState.dist ? ' active' : ''}" data-dist="${d}" onclick="pSetDist(${d})">${d}m</button>`
  ).join('');
}

function switchMode(m) {
  pState.mode = m;
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  document.getElementById('pickPanel').style.display  = m === 'pick'  ? '' : 'none';
  document.getElementById('savedPanel').style.display = m === 'saved' ? '' : 'none';
  if (m === 'saved') renderSavedTab();
}

/* ── Pick panel ──────────────────────────────────────────────────────────── */
function refreshPickList() {
  const athletes = getEligibleAthletes();
  const saved    = loadPickFromStorage();

  // Preserve the saved order if it exists and athletes still match
  if (saved && saved.predictions) {
    const savedValid = saved.predictions.filter(n => athletes.find(a => a.name === n));
    const newOnes    = athletes.filter(a => !saved.predictions.includes(a.name)).map(a => a.name);
    predictionOrder  = [...savedValid, ...newOnes];
  } else {
    predictionOrder = athletes.map(a => a.name);
  }

  const hasSaved = !!saved;
  document.getElementById('pickEventTitle').textContent = eventLabel();
  document.getElementById('pickEventComp').textContent  = pState.comp;
  document.getElementById('saveStatus').textContent     = hasSaved
    ? `Last saved ${new Date(saved.savedAt).toLocaleDateString()}`
    : 'Unsaved';
  document.getElementById('saveStatus').className = hasSaved ? 'save-status saved' : 'save-status';

  renderPickList();
}

function renderPickList() {
  const athletes = getEligibleAthletes();
  const map      = Object.fromEntries(athletes.map(a => [a.name, a]));
  const ul       = document.getElementById('pickList');
  ul.innerHTML   = '';

  predictionOrder.forEach((name, idx) => {
    const a   = map[name];
    if (!a) return;
    const li  = document.createElement('li');
    li.className    = 'pick-item';
    li.draggable    = true;
    li.dataset.idx  = idx;
    li.dataset.name = name;

    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
    li.innerHTML = `
      <span class="pick-pos">${medal}</span>
      <span class="pick-handle" title="Drag to reorder">⠿</span>
      <span class="pick-flag">${a.flag}</span>
      <span class="pick-name">${a.name}</span>
      <span class="pick-country">${a.country}</span>
      <span class="pick-pb">${fmtTime(a.pb)}</span>
    `;

    // Drag events
    li.addEventListener('dragstart', onDragStart);
    li.addEventListener('dragover',  onDragOver);
    li.addEventListener('dragleave', onDragLeave);
    li.addEventListener('drop',      onDrop);
    li.addEventListener('dragend',   onDragEnd);

    // Touch events for mobile
    li.addEventListener('touchstart', onTouchStart, { passive: false });
    li.addEventListener('touchmove',  onTouchMove,  { passive: false });
    li.addEventListener('touchend',   onTouchEnd);

    ul.appendChild(li);
  });
}

/* ── Drag-and-drop (mouse) ───────────────────────────────────────────────── */
function onDragStart(e) {
  dragSrcEl = this;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.idx);
  setTimeout(() => this.classList.add('dragging'), 0);
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}
function onDragLeave() { this.classList.remove('drag-over'); }
function onDrop(e) {
  e.stopPropagation();
  this.classList.remove('drag-over');
  if (dragSrcEl && dragSrcEl !== this) {
    const from = parseInt(dragSrcEl.dataset.idx);
    const to   = parseInt(this.dataset.idx);
    const [moved] = predictionOrder.splice(from, 1);
    predictionOrder.splice(to, 0, moved);
    renderPickList();
  }
}
function onDragEnd() {
  document.querySelectorAll('.pick-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
  dragSrcEl = null;
}

/* ── Touch drag ───────────────────────────────────────────────────────────── */
let _touchSrcIdx = null, _touchGhost = null;
function onTouchStart(e) {
  _touchSrcIdx = parseInt(this.dataset.idx);
  this.classList.add('dragging');
}
function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const el    = document.elementFromPoint(touch.clientX, touch.clientY);
  const item  = el && el.closest('.pick-item');
  document.querySelectorAll('.pick-item').forEach(i => i.classList.remove('drag-over'));
  if (item && item !== document.querySelector(`.pick-item[data-idx="${_touchSrcIdx}"]`)) {
    item.classList.add('drag-over');
  }
}
function onTouchEnd(e) {
  const touch = e.changedTouches[0];
  const el    = document.elementFromPoint(touch.clientX, touch.clientY);
  const item  = el && el.closest('.pick-item');
  document.querySelectorAll('.pick-item').forEach(i => i.classList.remove('drag-over', 'dragging'));
  if (item && _touchSrcIdx !== null) {
    const to = parseInt(item.dataset.idx);
    if (to !== _touchSrcIdx) {
      const [moved] = predictionOrder.splice(_touchSrcIdx, 1);
      predictionOrder.splice(to, 0, moved);
      renderPickList();
    }
  }
  _touchSrcIdx = null;
}

/* ── Save pick ────────────────────────────────────────────────────────────── */
function savePick() {
  savePickToStorage();
  const status = document.getElementById('saveStatus');
  status.textContent = `Saved ${new Date().toLocaleDateString()}`;
  status.className   = 'save-status saved';

  // Brief flash confirmation
  const btn = document.getElementById('saveBtn');
  btn.textContent = '✓ Saved!';
  btn.style.background = 'var(--green)';
  setTimeout(() => { btn.textContent = '💾 Save My Picks'; btn.style.background = ''; }, 1500);
}

/* ── Saved panel (view all + enter results) ──────────────────────────────── */
function renderSavedTab() {
  const picks = getAllSavedPicks();
  const el    = document.getElementById('savedList');

  if (!picks.length) {
    el.innerHTML = `<div class="no-data" style="padding:40px;text-align:center">
      No saved picks yet — make your first prediction in the Pick tab!
    </div>`;
    return;
  }

  el.innerHTML = picks.map(p => {
    const skey  = `pick:${p.comp}:${p.event}`;
    const dated = new Date(p.savedAt).toLocaleDateString();
    const hasResults = !!p.results;
    const scoreHtml  = hasResults && p.scored ? renderScoreCard(p) : '';

    const predRows = p.predictions.slice(0, 8).map((name, i) => {
      const actualPos = hasResults ? p.results.indexOf(name) : -1;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
      const actualBadge = actualPos === -1 ? '' : actualPos === i
        ? `<span class="match-badge exact">✓ ${actualPos + 1}</span>`
        : Math.abs(actualPos - i) === 1
          ? `<span class="match-badge close">≈ ${actualPos + 1}</span>`
          : `<span class="match-badge miss">✗ ${actualPos + 1}</span>`;
      return `<div class="saved-row">${medal} ${name} ${actualBadge}</div>`;
    }).join('');

    // Results entry (drag-and-drop similar to pick list, keyed by skey)
    const resultsHtml = hasResults
      ? `<div class="results-entered">
           <div class="results-label">Actual results entered</div>
           ${p.results.slice(0, 8).map((n, i) => `<div class="saved-row result-row">${i + 1}. ${n}</div>`).join('')}
           <button class="clear-results-btn" onclick="clearResults('${skey}')">✕ Clear results</button>
         </div>`
      : renderResultsEntry(p, skey);

    return `
      <div class="saved-card" id="card-${CSS.escape(skey)}">
        <div class="saved-card-header">
          <div>
            <div class="saved-event-name">${p.eventLabel}</div>
            <div class="saved-meta">${p.comp} · Picked ${dated}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${hasResults && p.scored ? `<div class="score-chip">${p.scored.pct}% <span style="font-weight:400;font-size:0.7rem">(${p.scored.total}/${p.scored.max})</span></div>` : ''}
            <button class="delete-btn" onclick="deletePick('${skey}')" title="Delete">🗑</button>
          </div>
        </div>
        <div class="saved-body">
          <div class="saved-prediction-col">
            <div class="col-label">My Picks</div>
            ${predRows}
          </div>
          <div class="saved-results-col">
            <div class="col-label">Actual Results</div>
            ${resultsHtml}
          </div>
        </div>
        ${scoreHtml}
      </div>`;
  }).join('');
}

function renderResultsEntry(pick, skey) {
  // A simple ordered-input where user types/selects finishers
  const names = pick.predictions.slice(0, 8);
  const options = pick.predictions.map(n => `<option value="${n}">${n}</option>`).join('');
  const selects = names.map((n, i) => `
    <div class="result-entry-row">
      <span class="result-pos">${i + 1}</span>
      <select class="result-select" id="${CSS.escape(skey)}-pos${i}">
        <option value="">— select —</option>
        ${options}
      </select>
    </div>`).join('');

  return `
    <div class="results-entry">
      ${selects}
      <button class="save-results-btn" onclick="submitResults('${skey}', ${pick.predictions.length})">
        ✓ Submit Results
      </button>
    </div>`;
}

function submitResults(skey, numPicked) {
  const names = [];
  for (let i = 0; i < Math.min(numPicked, 8); i++) {
    const sel = document.getElementById(`${CSS.escape(skey)}-pos${i}`);
    if (sel && sel.value) names.push(sel.value);
  }
  if (names.length < 3) {
    alert('Please enter at least the top 3 finishers.');
    return;
  }
  // Deduplicate (user might pick same athlete twice)
  const unique = [...new Set(names)];
  localStorage.setItem(skey, JSON.stringify({
    ...JSON.parse(localStorage.getItem(skey)),
    results: unique,
    scored:  scorePick(JSON.parse(localStorage.getItem(skey)).predictions, unique),
  }));
  renderSavedTab();
}

function clearResults(skey) {
  const rec = JSON.parse(localStorage.getItem(skey));
  rec.results = null; rec.scored = null;
  localStorage.setItem(skey, JSON.stringify(rec));
  renderSavedTab();
}

function renderScoreCard(pick) {
  const s = pick.scored;
  const barWidth = s.pct;
  const color = s.pct >= 70 ? 'var(--green)' : s.pct >= 40 ? 'var(--gold)' : 'var(--red)';
  const rows = s.breakdown.map(b => {
    const medal = b.pos === 1 ? '🥇' : b.pos === 2 ? '🥈' : b.pos === 3 ? '🥉' : b.pos;
    const cls   = b.pts === b.posMax ? 'score-exact' : b.pts > 0 ? 'score-close' : 'score-miss';
    return `<tr class="${cls}">
      <td>${medal}</td>
      <td>${b.athlete}</td>
      <td>${b.note}</td>
      <td style="text-align:right;font-weight:700">${b.pts}/${b.posMax}</td>
    </tr>`;
  }).join('');

  return `
    <div class="score-card">
      <div class="score-header">
        <span>Score: <strong>${s.total}/${s.max} pts</strong></span>
        <span class="score-pct" style="color:${color}">${s.pct}%</span>
      </div>
      <div class="score-bar-bg"><div class="score-bar-fill" style="width:${barWidth}%;background:${color}"></div></div>
      <table class="score-table">
        <thead><tr><th>Pos</th><th>Athlete</th><th>Result</th><th style="text-align:right">Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
(function init() {
  loadAthletes().then(() => {
    pUpdateDistBtns();
    refreshPickList();
  });
})();
