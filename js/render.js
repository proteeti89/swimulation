/* ─── Render Engine ─────────────────────────────────────────────────────────── */
'use strict';

/* ── Medal probability bar ──────────────────────────────────────────────────── */
function probBar(pct, rank) {
  const cls = rank === 1 ? 'prob-bar-gold'
            : rank === 2 ? 'prob-bar-green'
            : rank === 3 ? 'prob-bar-blue'
            : 'prob-bar-grey';
  return `
    <div class="prob-bar-wrap">
      <div class="prob-bar-bg">
        <div class="prob-bar-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="prob-pct">${pct}%</span>
    </div>`;
}

/* ── WR badge ───────────────────────────────────────────────────────────────── */
function wrBadge(time, eventKey) {
  const wr = WORLD_RECORDS[eventKey];
  if (!wr) return '';
  if (Math.abs(time - wr.time) < 0.05) return '<span class="wr-badge">WR</span>';
  return '';
}

/* ── Leaderboard ────────────────────────────────────────────────────────────── */
function renderLeaderboard(state) {
  const { gender, cat, dist, comp } = state;
  const key = `${gender}-${CAT_ABBR[cat]}-${dist}`;
  const athletes = (ATHLETES[key] || []).slice();

  if (!athletes.length) {
    document.getElementById('leaderboardBody').innerHTML =
      `<tr><td colspan="8" class="no-data">No data for this event.</td></tr>`;
    return [];
  }

  // Run MC once with stable seed for display; probs use Date.now() seed
  const displayRng = makeRng(42 + state.seed);
  const sorted = predictRace(athletes, displayRng);
  const probs  = monteCarloProbs(athletes, 300);

  const eventKey = `${gender}-${cat === 'IM' ? 'IM' : CAT_ABBR[cat]}-${dist}`;
  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';

  sorted.forEach((a, idx) => {
    const rank = idx + 1;
    const posCls = rank === 1 ? 'pos-1' : rank === 2 ? 'pos-2' : rank === 3 ? 'pos-3' : 'pos-other';
    const posLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const p = probs[a.name] || { medal: '0', top8: '0', gold: '0' };
    const displayPct  = rank <= 3 ? p.medal : p.top8;
    const trend = trendArrow(a);
    const noteHtml = a.note ? `<span style="font-size:0.65rem;color:var(--text-muted);display:block;margin-top:2px">${a.note}</span>` : '';
    const badge = wrBadge(a.predictedTime, eventKey);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pos-cell ${posCls}">${posLabel}</td>
      <td>
        <div class="athlete-name">${a.flag} ${a.name}${badge}</div>
        <div class="athlete-country">${a.country}${noteHtml}</div>
      </td>
      <td><span class="pred-time">${fmtTime(a.predictedTime)}</span></td>
      <td class="prob-cell">${probBar(displayPct, rank)}</td>
      <td class="time-mono">${fmtTime(a.pb)}</td>
      <td class="time-mono">${fmtTime(a.sb)}</td>
      <td class="age-cell">${a.age}</td>
      <td><span class="${trend.cls}">${trend.symbol}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Update event title
  const gLabel = gender === 'M' ? "Men's" : "Women's";
  document.getElementById('eventTitle').textContent = `${gLabel} ${dist}m ${cat === 'IM' ? 'Individual Medley' : cat}`;
  document.getElementById('eventSubtitle').textContent = `${comp} — Predicted Results`;

  return sorted;
}

/* ── Historical Form Charts ──────────────────────────────────────────────────── */
function renderFormCharts(sorted) {
  const container = document.getElementById('formCharts');
  container.innerHTML = '';
  const top5 = sorted.slice(0, 5);

  top5.forEach(a => {
    const hist = a.hist || {};
    const years = [2022, 2023, 2024, 2025];
    const times = years.map(y => hist[y] || null);
    const validTimes = times.filter(Boolean);
    if (!validTimes.length) return;

    const minT = Math.min(...validTimes);
    const maxT = Math.max(...validTimes);
    const range = maxT - minT || 1;

    const barsHtml = years.map((y, i) => {
      const t = times[i];
      if (!t) return `<div class="form-year-col"><div class="form-bar" style="height:0;background:var(--border)"></div><div class="form-year-label">${y}</div><div class="form-time-label">—</div></div>`;
      const heightPct = 20 + ((maxT - t) / range) * 80;
      const hue = 180 + (i / 3) * 40; // teal gradient
      return `
        <div class="form-year-col">
          <div class="form-bar" style="height:${heightPct}%;background:hsl(${hue},80%,48%)"></div>
          <div class="form-year-label">${y}</div>
          <div class="form-time-label">${fmtTime(t)}</div>
        </div>`;
    }).join('');

    const div = document.createElement('div');
    div.className = 'form-athlete';
    div.innerHTML = `
      <div class="form-athlete-name">${a.flag} ${a.name}</div>
      <div class="form-athlete-country">${a.country}</div>
      <div class="form-bars">${barsHtml}</div>
    `;
    container.appendChild(div);
  });
}

/* ── Head-to-Head Panel ───────────────────────────────────────────────────────── */
function populateH2HSelects(sorted) {
  ['h2h1', 'h2h2'].forEach((id, i) => {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = '';
    sorted.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.name;
      opt.textContent = `${a.flag} ${a.name}`;
      sel.appendChild(opt);
    });
    // Default: h2h1 = #1, h2h2 = #2
    if (prev && sorted.find(a => a.name === prev)) {
      sel.value = prev;
    } else {
      sel.selectedIndex = i < sorted.length ? i : 0;
    }
  });
}

function renderH2H() {
  const sel1 = document.getElementById('h2h1');
  const sel2 = document.getElementById('h2h2');
  const panel = document.getElementById('h2hPanel');

  const { gender, cat, dist } = window._appState || {};
  if (!gender) return;

  const key = `${gender}-${CAT_ABBR[cat]}-${dist}`;
  const athletes = ATHLETES[key] || [];

  const a1 = athletes.find(a => a.name === sel1.value);
  const a2 = athletes.find(a => a.name === sel2.value);

  if (!a1 || !a2 || a1.name === a2.name) {
    panel.innerHTML = '<div class="no-data">Select two different athletes to compare.</div>';
    return;
  }

  const prob1 = parseInt(h2hProb(a1, a2, 300), 10);
  const prob2 = 100 - prob1;
  const w1 = prob1 >= prob2;

  function statRows(a) {
    const hist = a.hist || {};
    const years = Object.keys(hist).sort();
    const recent = years.slice(-3).map(y => `<div style="font-size:0.72rem;color:var(--text-muted)">${y}: ${fmtTime(hist[y])}</div>`).join('');
    return `
      <div class="h2h-stat"><span class="h2h-stat-label">PB</span><span class="h2h-stat-val ${a.pb <= (athletes.find(x => x.name !== a.name)?.pb || 99999) ? 'win' : ''}">${fmtTime(a.pb)}</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">SB '25</span><span class="h2h-stat-val">${fmtTime(a.sb)}</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">Age</span><span class="h2h-stat-val">${a.age}</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">Trend</span><span class="h2h-stat-val ${trendArrow(a).cls}">${trendArrow(a).symbol}</span></div>
      <div style="margin-top:8px">${recent}</div>
    `;
  }

  panel.innerHTML = `
    <div class="h2h-comparison">
      <div class="h2h-athlete ${w1 ? 'winner' : ''}">
        <div class="h2h-name">${a1.flag} ${a1.name}</div>
        <div class="h2h-country">${a1.country} · Age ${a1.age}</div>
        <div class="h2h-stats">${statRows(a1)}</div>
        ${w1 ? '<div class="favored-badge" style="margin-top:12px">Favored</div>' : ''}
        <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);font-weight:700">${prob1}% win prob</div>
      </div>
      <div class="h2h-mid">
        <div class="h2h-label">Win probability</div>
        <div class="h2h-prob-bar">
          <div class="h2h-prob-fill" style="height:${prob1}%"></div>
        </div>
        <div class="vs-badge">VS</div>
      </div>
      <div class="h2h-athlete ${!w1 ? 'winner' : ''}">
        <div class="h2h-name">${a2.flag} ${a2.name}</div>
        <div class="h2h-country">${a2.country} · Age ${a2.age}</div>
        <div class="h2h-stats">${statRows(a2)}</div>
        ${!w1 ? '<div class="favored-badge" style="margin-top:12px">Favored</div>' : ''}
        <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);font-weight:700">${prob2}% win prob</div>
      </div>
    </div>
  `;
}
