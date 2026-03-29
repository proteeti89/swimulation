/* ─── App State & Entry Point ───────────────────────────────────────────────── */
'use strict';

const state = {
  gender: 'M',
  cat:    'Freestyle',
  dist:   100,
  comp:   'World Aquatics Championships',
  seed:   1,
};

// Expose for renderH2H access
window._appState = state;

/* ── Controls ───────────────────────────────────────────────────────────────── */
function setGender(g) {
  state.gender = g;
  document.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().startsWith(g === 'M' ? 'Men' : 'Women'));
  });
  updateDistBtns();
  refresh();
}

function setCat(c) {
  state.cat = c;
  document.querySelectorAll('.cat-tab').forEach(b => {
    b.classList.toggle('active', b.textContent.trim() === c ||
      (c === 'IM' && b.textContent.includes('Medley')));
  });
  // Reset dist to first available
  const dists = EVENTS[c] || [];
  state.dist = dists[0] || 100;
  updateDistBtns();
  refresh();
}

function setDist(d) {
  state.dist = d;
  document.querySelectorAll('.dist-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.dist) === d);
  });
  refresh();
}

function updateDistBtns() {
  const container = document.getElementById('distBtns');
  const dists = EVENTS[state.cat] || [];
  // Ensure dist is valid
  if (!dists.includes(state.dist)) state.dist = dists[0];
  container.innerHTML = dists.map(d =>
    `<button class="dist-btn${d === state.dist ? ' active' : ''}" data-dist="${d}" onclick="setDist(${d})">${d}m</button>`
  ).join('');
}

function regenerate() {
  state.seed = (state.seed + 1) % 9999;
  refresh();
}

/* ── Competition selector ───────────────────────────────────────────────────── */
document.getElementById('compSelect').addEventListener('change', function () {
  state.comp = this.value;
  refresh();
});

/* ── Main render cycle ──────────────────────────────────────────────────────── */
function refresh() {
  const card = document.getElementById('leaderboardCard');
  card.classList.remove('animate-in');
  void card.offsetWidth; // reflow
  card.classList.add('animate-in');

  const sorted = renderLeaderboard(state);
  if (sorted && sorted.length) {
    renderFormCharts(sorted);
    populateH2HSelects(sorted);
    renderH2H();
  }
}

/* ── Init ───────────────────────────────────────────────────────────────────── */
(function init() {
  updateDistBtns();
  refresh();
})();
