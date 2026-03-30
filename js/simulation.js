/* ─── Simulation Engine v2.0 ─────────────────────────────────────────────────
 * Model improvements:
 *  - Age curve adjustment (event-type-specific peak ages + decline)
 *  - Competition-type multiplier (champsMult) per athlete
 *  - Event-specific Monte Carlo variance (50m > 1500m)
 *  - H2H historical win probability weighting
 *  - Only active athletes included in simulations
 * ──────────────────────────────────────────────────────────────────────────── */
'use strict';

/* ── Time formatting ─────────────────────────────────────────────────────────── */
function fmtTime(seconds) {
  if (!seconds || isNaN(seconds)) return '—';
  if (seconds < 60) return seconds.toFixed(2);
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${m}:${s}`;
}

/* ── Seeded LCG RNG ─────────────────────────────────────────────────────────── */
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ── Age curve ──────────────────────────────────────────────────────────────────
 * Returns a multiplier: 1.0 = no effect, > 1.0 = slower (past peak),
 * < 1.0 = still improving (before peak). Effect is small (max ±1.5%).
 * Peak ages and decline rates by event type:
 *   sprint  (50/100m):     peak 23, decline 0.4%/yr after 26
 *   middle  (200/400m):    peak 24, decline 0.3%/yr after 27
 *   distance(800/1500m):   peak 26, decline 0.25%/yr after 29
 *   technical (breast/fly): peak 22, decline 0.45%/yr after 25
 *   IM:                     peak 23, decline 0.35%/yr after 26
 */
const AGE_CURVE = {
  sprint:    { peak: 23, onsetAge: 26, declinePerYear: 0.004 },
  middle:    { peak: 24, onsetAge: 27, declinePerYear: 0.003 },
  distance:  { peak: 26, onsetAge: 29, declinePerYear: 0.0025 },
  technical: { peak: 22, onsetAge: 25, declinePerYear: 0.0045 },
  im:        { peak: 23, onsetAge: 26, declinePerYear: 0.0035 },
};

function getAgeCurveType(eventKey) {
  const dist = parseInt(eventKey.split('-').pop(), 10);
  const stroke = eventKey.split('-')[1];
  if (stroke === 'IM') return 'im';
  if (stroke === 'Breast' || stroke === 'Fly') return 'technical';
  if (dist >= 800) return 'distance';
  if (dist >= 200) return 'middle';
  return 'sprint';
}

function ageCurveMultiplier(athlete, eventKey) {
  const curveType = getAgeCurveType(eventKey);
  const curve = AGE_CURVE[curveType];
  const age = athlete.age;
  // Before peak: slight improvement potential (up to -0.5% for very young)
  if (age < curve.peak) {
    const yearsFromPeak = curve.peak - age;
    return 1 - Math.min(yearsFromPeak * 0.002, 0.005); // young = slightly faster potential
  }
  // Between peak and onset: no adjustment
  if (age <= curve.onsetAge) return 1.0;
  // After onset: apply decline
  const yearsOfDecline = age - curve.onsetAge;
  const penalty = Math.min(yearsOfDecline * curve.declinePerYear, 0.015); // cap at 1.5%
  return 1 + penalty;
}

/* ── Event-specific variance ────────────────────────────────────────────────────
 * 50m: ±1.2% — one false start / bad turn = race over
 * 100m: ±0.8%
 * 200m: ±0.6%
 * 400m: ±0.5%
 * 800m: ±0.4%
 * 1500m: ±0.35%
 */
const EVENT_VARIANCE = {
  50:   0.012,
  100:  0.008,
  200:  0.006,
  400:  0.005,
  800:  0.004,
  1500: 0.0035,
};

function getEventVariance(eventKey) {
  const dist = parseInt(eventKey.split('-').pop(), 10);
  return EVENT_VARIANCE[dist] || 0.006;
}

/* ── Consistency score ──────────────────────────────────────────────────────── */
function consistencyScore(athlete) {
  const years = Object.values(athlete.hist || {}).filter(Boolean);
  if (years.length < 2) return 0.7;
  const mean = years.reduce((a, b) => a + b, 0) / years.length;
  const variance = years.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / years.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(1, 1 - cv * 25));
}

/* ── Trend score ────────────────────────────────────────────────────────────── */
function trendScore(athlete) {
  const hist = athlete.hist || {};
  const sorted = Object.entries(hist)
    .filter(([, v]) => v)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));
  if (sorted.length < 2) return 0.5;
  // Use last 2 years weighted, last 3 if available
  const n = sorted.length;
  if (n >= 3) {
    const [t1, t2, t3] = [sorted[n-3][1], sorted[n-2][1], sorted[n-1][1]];
    const recentSlope = (t3 - t2) + 0.5 * (t2 - t1); // weighted
    if (recentSlope < -0.1) return 0.80; // improving
    if (recentSlope > 0.1)  return 0.20; // declining
    return 0.50;
  }
  const recent = sorted.slice(-2).map(([, v]) => v);
  if (recent[1] < recent[0]) return 0.75;
  if (recent[1] > recent[0]) return 0.25;
  return 0.50;
}

function trendArrow(athlete) {
  const score = trendScore(athlete);
  if (score > 0.6) return { symbol: '↑', cls: 'trend-up' };
  if (score < 0.4) return { symbol: '↓', cls: 'trend-down' };
  return { symbol: '→', cls: 'trend-flat' };
}

/* ── H2H historical probability adjustment ──────────────────────────────────── */
function h2hHistoricalProb(a1, a2) {
  const h2h = a1.h2h || {};
  const record = h2h[a2.name];
  if (!record || (record.wins + record.losses) < 3) return null; // not enough data
  const total = record.wins + record.losses;
  return record.wins / total; // historical win rate
}

/* ── Weighted base score ────────────────────────────────────────────────────── */
function weightedScore(athlete, eventKey) {
  const sb   = athlete.sb;
  const pb   = athlete.pb;
  const cons = consistencyScore(athlete);
  const trend = trendScore(athlete);
  // Base time: season-best weighted 65%, PB weighted 35%
  const baseTime = 0.65 * sb + 0.35 * pb;
  // Small adjustments: ±0.5% max each
  const consAdj  = (1 - cons)  * baseTime * 0.005;
  const trendAdj = (0.5 - trend) * baseTime * 0.005;
  // Age curve adjustment
  const ageMult = ageCurveMultiplier(athlete, eventKey || 'M-Free-100');
  // Championship multiplier (used in predictRace when in champs mode)
  return (baseTime + consAdj + trendAdj) * ageMult;
}

/* ── Single race prediction ─────────────────────────────────────────────────── */
function predictRace(athletes, rng, eventKey, isChampionship) {
  const variance = getEventVariance(eventKey || 'M-Free-100');
  return athletes
    .filter(a => a.active !== false) // exclude retired/inactive
    .map(a => {
      const base = weightedScore(a, eventKey);
      // Apply championship multiplier when at a major meet
      const champAdj = (isChampionship !== false) ? (a.champsMult || 1.0) : 1.0;
      const noiseVar = 1 + (rng() - 0.5) * variance * 2;
      return { ...a, predictedTime: base * champAdj * noiseVar };
    })
    .sort((a, b) => a.predictedTime - b.predictedTime);
}

/* ── Monte Carlo probabilities ─────────────────────────────────────────────── */
function monteCarloProbs(athletes, runs, eventKey) {
  runs = runs || 300;
  const activeAthletes = athletes.filter(a => a.active !== false);
  const counts = {};
  activeAthletes.forEach(a => { counts[a.name] = { gold: 0, silver: 0, bronze: 0, top8: 0 }; });

  const seedBase = Date.now();
  for (let i = 0; i < runs; i++) {
    const rng    = makeRng(seedBase + i * 7919);
    const result = predictRace(activeAthletes, rng, eventKey, true);
    result.forEach((a, idx) => {
      if (idx === 0) counts[a.name].gold++;
      if (idx === 1) counts[a.name].silver++;
      if (idx === 2) counts[a.name].bronze++;
      if (idx < 8)   counts[a.name].top8++;
    });
  }

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
function h2hProb(a1, a2, runs, eventKey) {
  runs = runs || 300;
  // Check historical record first
  const histProb = h2hHistoricalProb(a1, a2);
  let simProb = 0;
  const seedBase = Date.now() + 99991;
  for (let i = 0; i < runs; i++) {
    const rng      = makeRng(seedBase + i * 6271);
    const variance = getEventVariance(eventKey || 'M-Free-100');
    const champ1   = a1.champsMult || 1.0;
    const champ2   = a2.champsMult || 1.0;
    const age1     = ageCurveMultiplier(a1, eventKey || 'M-Free-100');
    const age2     = ageCurveMultiplier(a2, eventKey || 'M-Free-100');
    const base1    = weightedScore(a1, eventKey) * champ1 * age1;
    const base2    = weightedScore(a2, eventKey) * champ2 * age2;
    const t1       = base1 * (1 + (rng() - 0.5) * variance * 2);
    const t2       = base2 * (1 + (rng() - 0.5) * variance * 2);
    if (t1 < t2) simProb++;
  }
  simProb = simProb / runs;

  // Blend sim (70%) with historical record (30%) if data exists
  const blended = histProb !== null
    ? 0.70 * simProb + 0.30 * histProb
    : simProb;

  return (blended * 100).toFixed(0);
}
