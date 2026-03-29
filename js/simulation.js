/* ─── Simulation Engine ─────────────────────────────────────────────────────── */
'use strict';

/* ── Time formatting ─────────────────────────────────────────────────────────── */
function fmtTime(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 60) return seconds.toFixed(2);
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

function parseTime(str) {
  if (!str || str === '—') return null;
  if (typeof str === 'number') return str;
  const parts = str.split(':');
  if (parts.length === 1) return parseFloat(parts[0]);
  return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
}

/* ── Seeded LCG RNG ─────────────────────────────────────────────────────────── */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ── Athlete scoring helpers ─────────────────────────────────────────────────── */
function consistencyScore(athlete) {
  const years = Object.values(athlete.hist || {}).filter(Boolean);
  if (years.length < 2) return 0.7;
  const mean = years.reduce((a, b) => a + b, 0) / years.length;
  const variance = years.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / years.length;
  const cv = Math.sqrt(variance) / mean;   // coefficient of variation
  // cv ≈ 0 → perfect consistency → score 1.0; cv ≈ 0.02 → score ≈ 0.5
  return Math.max(0, Math.min(1, 1 - cv * 25));
}

function trendScore(athlete) {
  const hist = athlete.hist || {};
  const sorted = Object.entries(hist)
    .filter(([, v]) => v)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  if (sorted.length < 2) return 0.5;
  const recent = sorted.slice(-2).map(([, v]) => v);
  // lower time is better; improve → trend > 0.5
  if (recent[1] < recent[0]) return 0.75;  // getting faster
  if (recent[1] > recent[0]) return 0.25;  // getting slower
  return 0.5;
}

function trendArrow(athlete) {
  const score = trendScore(athlete);
  if (score > 0.5) return { symbol: '↑', cls: 'trend-up' };
  if (score < 0.5) return { symbol: '↓', cls: 'trend-down' };
  return { symbol: '→', cls: 'trend-flat' };
}

/* ── Weighted base score ────────────────────────────────────────────────────── */
function weightedScore(athlete) {
  const sb   = athlete.sb;
  const pb   = athlete.pb;
  const cons = consistencyScore(athlete);
  const trend = trendScore(athlete);
  // Base time: season-best weighted 65%, PB weighted 35%
  const baseTime = 0.65 * sb + 0.35 * pb;
  // Small adjustments: ±0.5% max
  const consAdj  = (1 - cons)  * baseTime * 0.005;  // inconsistent → slower
  const trendAdj = (0.5 - trend) * baseTime * 0.005; // declining → slower
  return baseTime + consAdj + trendAdj;
}

/* ── Single race prediction ─────────────────────────────────────────────────── */
function predictRace(athletes, rng) {
  return athletes.map(a => {
    const base     = weightedScore(a);
    const variance = 1 + (rng() - 0.5) * 0.010; // ±0.5%
    return { ...a, predictedTime: base * variance };
  }).sort((a, b) => a.predictedTime - b.predictedTime);
}

/* ── Monte Carlo probabilities ─────────────────────────────────────────────── */
function monteCarloProbs(athletes, runs = 300) {
  const counts = {};
  athletes.forEach(a => { counts[a.name] = { gold: 0, silver: 0, bronze: 0, top8: 0 }; });

  const seedBase = Date.now();
  for (let i = 0; i < runs; i++) {
    const rng    = makeRng(seedBase + i * 7919);
    const result = predictRace(athletes, rng);
    result.forEach((a, idx) => {
      if (idx === 0) counts[a.name].gold++;
      if (idx === 1) counts[a.name].silver++;
      if (idx === 2) counts[a.name].bronze++;
      if (idx < 8)   counts[a.name].top8++;
    });
  }

  // Convert to percentages
  const probs = {};
  for (const [name, c] of Object.entries(counts)) {
    probs[name] = {
      gold:   (c.gold   / runs * 100).toFixed(0),
      silver: (c.silver / runs * 100).toFixed(0),
      bronze: (c.bronze / runs * 100).toFixed(0),
      medal:  ((c.gold + c.silver + c.bronze) / runs * 100).toFixed(0),
      top8:   (c.top8   / runs * 100).toFixed(0),
    };
  }
  return probs;
}

/* ── Head-to-head win probability ──────────────────────────────────────────── */
function h2hProb(a1, a2, runs = 300) {
  let a1wins = 0;
  const seedBase = Date.now() + 99991;
  for (let i = 0; i < runs; i++) {
    const rng  = makeRng(seedBase + i * 6271);
    const t1   = weightedScore(a1) * (1 + (rng() - 0.5) * 0.010);
    const t2   = weightedScore(a2) * (1 + (rng() - 0.5) * 0.010);
    if (t1 < t2) a1wins++;
  }
  return (a1wins / runs * 100).toFixed(0);
}
