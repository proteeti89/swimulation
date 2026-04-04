/* ─── App State & Entry Point ───────────────────────────────────────────────── */
'use strict';

const state = {
  gender: 'W',
  cat:    'Freestyle',
  dist:   100,
  comp:   'World Aquatics Championships',
  isChampionship: true,
  seed:   1,
};

window._appState = state;

/* ── Load athletes.json dynamically ─────────────────────────────────────────── */
function loadAthletes() {
  return fetch('js/data/athletes.json')
    .then(r => r.json())
    .then(data => {
      window.ATHLETES = data.events;
      window._athletesMeta = data.meta;
      document.getElementById('dataVersion').textContent =
        `Data: ${data.meta.lastUpdated} · v${data.meta.version}`;
      return data;
    })
    .catch(() => {
      // Fallback: ATHLETES already loaded via athletes.js <script> tag if JSON fails
      console.warn('JSON load failed, using inline data');
    });
}

/* ── Controls ───────────────────────────────────────────────────────────────── */
function setGender(g) {
  state.gender = g;
  document.querySelectorAll('.gender-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.gender === g);
  });
  updateDistBtns();
  refresh();
}

function setCat(c) {
  state.cat = c;
  document.querySelectorAll('.cat-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === c);
  });
  const dists = EVENTS[c] || [];
  if (!dists.includes(state.dist)) state.dist = dists[0];
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
const CHAMPS_EVENTS = new Set([
  'World Aquatics Championships', 'Olympic Games',
  'Pan Pacific Championships', 'European Aquatics Championships',
  'Commonwealth Games',
]);

document.getElementById('compSelect').addEventListener('change', function () {
  state.comp = this.value;
  state.isChampionship = CHAMPS_EVENTS.has(this.value);
  refresh();
});

/* ── Main render cycle ──────────────────────────────────────────────────────── */
function refresh() {
  const card = document.getElementById('leaderboardCard');
  card.classList.remove('animate-in');
  void card.offsetWidth;
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
  loadAthletes().then(() => {
    updateDistBtns();
    refresh();
  });
})();
