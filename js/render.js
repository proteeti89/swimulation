/* ─── Render Engine v2.0 ────────────────────────────────────────────────────── */
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

/* ── Status badges ──────────────────────────────────────────────────────────── */
function statusBadge(athlete) {
  if (athlete.active === false) {
    const label = athlete.retired ? `Ret. ${athlete.retired}` : 'Inactive';
    return `<span class="status-badge retired">${label}</span>`;
  }
  return '';
}

function wrBadge(athlete, eventKey) {
  const wr = WORLD_RECORDS[eventKey];
  if (!wr) return '';
  const t = athlete.predictedTime;
  if (athlete._belowWR) return '<span class="wr-badge wr-threat" title="Predicted to break the World Record">⚡WR</span>';
  if (Math.abs(t - wr.time) < 0.30) return '<span class="wr-badge wr-pace" title="World Record pace">≈WR</span>';
  return '';
}

/* ── Championship indicator ─────────────────────────────────────────────────── */
function champsIndicator(athlete) {
  const m = athlete.champsMult || 1.0;
  if (m <= 0.973) return '<span class="champs-badge champs-elite" title="Elite championship performer">★★★</span>';
  if (m <= 0.978) return '<span class="champs-badge champs-good" title="Strong championship performer">★★</span>';
  if (m <= 0.984) return '<span class="champs-badge champs-ok" title="Championship performer">★</span>';
  if (m >= 1.005) return '<span class="champs-badge champs-poor" title="Better in time trials">▼</span>';
  return '';
}

/* ── Leaderboard ────────────────────────────────────────────────────────────── */
function renderLeaderboard(state) {
  const { gender, cat, dist, comp, isChampionship, seed } = state;
  const key = `${gender}-${CAT_ABBR[cat]}-${dist}`;
  const allAthletes = (ATHLETES[key] || []).slice();
  const athletes = allAthletes.filter(a => a.active !== false);

  if (!athletes.length) {
    document.getElementById('leaderboardBody').innerHTML =
      `<tr><td colspan="9" class="no-data">No active athletes for this event.</td></tr>`;
    return [];
  }

  const displayRng = makeRng(42 + seed);
  const sorted = predictRace(athletes, displayRng, key, isChampionship);
  const probs  = monteCarloProbs(athletes, 300, key);

  const tbody = document.getElementById('leaderboardBody');
  tbody.innerHTML = '';

  // World Record reference row
  const wr = (typeof WORLD_RECORDS !== 'undefined') ? WORLD_RECORDS[key] : null;
  if (wr) {
    const wrRow = document.createElement('tr');
    wrRow.className = 'wr-ref-row';
    wrRow.innerHTML = `
      <td class="pos-cell wr-ref-pos">WR</td>
      <td>
        <div class="athlete-name wr-ref-name">🌍 ${wr.holder}</div>
        <div class="athlete-country">World Record · ${wr.year}</div>
      </td>
      <td><span class="pred-time wr-ref-time">${fmtTime(wr.time)}</span></td>
      <td colspan="6" class="wr-ref-note">← benchmark · WR-caliber athletes may break this</td>
    `;
    tbody.appendChild(wrRow);
  }

  sorted.forEach((a, idx) => {
    const rank = idx + 1;
    const posCls = rank === 1 ? 'pos-1' : rank === 2 ? 'pos-2' : rank === 3 ? 'pos-3' : 'pos-other';
    const posLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const p = probs[a.name] || { medal: '0', top8: '0' };
    const displayPct = rank <= 3 ? p.medal : p.top8;
    const trend = trendArrow(a);
    const badge  = wrBadge(a, key);
    const champs = champsIndicator(a);
    const noteHtml = a.note
      ? `<span style="font-size:0.65rem;color:var(--text-muted);display:block;margin-top:2px">${a.note}</span>`
      : '';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pos-cell ${posCls}">${posLabel}</td>
      <td>
        <div class="athlete-name">${a.flag} ${a.name}${badge}${champs}</div>
        <div class="athlete-country">${a.country}${noteHtml}</div>
      </td>
      <td><span class="pred-time">${fmtTime(a.predictedTime)}</span></td>
      <td class="prob-cell">${probBar(displayPct, rank)}</td>
      <td class="time-mono">${fmtTime(a.pb)}</td>
      <td class="time-mono">${fmtTime(a.sb)}</td>
      <td class="age-cell">${a.age}</td>
      <td><span class="${trend.cls}">${trend.symbol}</span></td>
      <td class="champs-mult-cell" title="Champs multiplier">${((a.champsMult||1)*100-100).toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });

  // Retired athletes row (collapsed)
  const retired = allAthletes.filter(a => a.active === false);
  if (retired.length) {
    const tr = document.createElement('tr');
    tr.className = 'retired-row';
    tr.innerHTML = `<td colspan="9" class="retired-note">
      ${retired.length} retired/inactive athlete${retired.length>1?'s':''} excluded:
      ${retired.map(a => `${a.flag} ${a.name}${a.retired?' (ret. '+a.retired+')':''}`).join(', ')}
    </td>`;
    tbody.appendChild(tr);
  }

  const gLabel = gender === 'M' ? "Men's" : "Women's";
  const champsNote = isChampionship ? ' (championship adjustments active)' : '';
  document.getElementById('eventTitle').textContent = `${gLabel} ${dist}m ${cat === 'IM' ? 'Individual Medley' : cat}`;
  document.getElementById('eventSubtitle').textContent = `${comp} — Predicted Results${champsNote}`;

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
      if (!t) return `<div class="form-year-col">
        <div class="form-bar" style="height:0"></div>
        <div class="form-year-label">${y}</div>
        <div class="form-time-label">—</div></div>`;
      const heightPct = 20 + ((maxT - t) / range) * 80;
      const hue = 180 + (i / 3) * 40;
      return `
        <div class="form-year-col">
          <div class="form-bar" style="height:${heightPct}%;background:hsl(${hue},80%,48%)"></div>
          <div class="form-year-label">${y}</div>
          <div class="form-time-label">${fmtTime(t)}</div>
        </div>`;
    }).join('');

    const trend = trendArrow(a);
    const div = document.createElement('div');
    div.className = 'form-athlete';
    div.innerHTML = `
      <div class="form-athlete-name">${a.flag} ${a.name} <span class="${trend.cls}" style="font-size:0.8rem">${trend.symbol}</span></div>
      <div class="form-athlete-country">${a.country} · Age ${a.age} · Champs: ${champsIndicator(a) || '—'}</div>
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
    if (prev && sorted.find(a => a.name === prev)) sel.value = prev;
    else sel.selectedIndex = i < sorted.length ? i : 0;
  });
}

function renderH2H() {
  const sel1 = document.getElementById('h2h1');
  const sel2 = document.getElementById('h2h2');
  const panel = document.getElementById('h2hPanel');
  const { gender, cat, dist } = window._appState || {};
  if (!gender) return;

  const key = `${gender}-${CAT_ABBR[cat]}-${dist}`;
  const athletes = (ATHLETES[key] || []).filter(a => a.active !== false);
  const a1 = athletes.find(a => a.name === sel1.value);
  const a2 = athletes.find(a => a.name === sel2.value);

  if (!a1 || !a2 || a1.name === a2.name) {
    panel.innerHTML = '<div class="no-data">Select two different athletes to compare.</div>';
    return;
  }

  const prob1 = parseInt(h2hProb(a1, a2, 300, key), 10);
  const prob2 = 100 - prob1;
  const w1 = prob1 >= prob2;

  // H2H historical record
  const hist1 = (a1.h2h || {})[a2.name];
  const hist2 = (a2.h2h || {})[a1.name];
  const histRecord = hist1
    ? `<div class="h2h-hist-record">Historical: ${hist1.wins}–${hist1.losses} (${(hist1.wins/(hist1.wins+hist1.losses)*100).toFixed(0)}%)</div>`
    : '';

  function statRows(a, opp) {
    const hist = a.hist || {};
    const years = Object.keys(hist).sort();
    const recent = years.slice(-3).map(y =>
      `<div style="font-size:0.72rem;color:var(--text-muted)">${y}: ${fmtTime(hist[y])}</div>`
    ).join('');
    const h2hRec = (a.h2h || {})[opp.name];
    const h2hHtml = h2hRec
      ? `<div class="h2h-stat"><span class="h2h-stat-label">H2H Record</span><span class="h2h-stat-val">${h2hRec.wins}W–${h2hRec.losses}L</span></div>`
      : '';
    const ageAdj = ageCurveMultiplier(a, key);
    const ageNote = ageAdj > 1.005 ? `⬇ age penalty ${((ageAdj-1)*100).toFixed(1)}%`
                  : ageAdj < 0.997 ? `⬆ youth boost ${((1-ageAdj)*100).toFixed(1)}%`
                  : 'peak years';
    return `
      <div class="h2h-stat"><span class="h2h-stat-label">PB</span><span class="h2h-stat-val">${fmtTime(a.pb)}</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">SB '25</span><span class="h2h-stat-val">${fmtTime(a.sb)}</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">Age</span><span class="h2h-stat-val">${a.age} (${ageNote})</span></div>
      <div class="h2h-stat"><span class="h2h-stat-label">Champs</span><span class="h2h-stat-val">${champsIndicator(a)||'neutral'}</span></div>
      ${h2hHtml}
      <div style="margin-top:8px">${recent}</div>
    `;
  }

  panel.innerHTML = `
    <div class="h2h-comparison">
      <div class="h2h-athlete ${w1 ? 'winner' : ''}">
        <div class="h2h-name">${a1.flag} ${a1.name}</div>
        <div class="h2h-country">${a1.country} · Age ${a1.age}</div>
        <div class="h2h-stats">${statRows(a1, a2)}</div>
        ${w1 ? '<div class="favored-badge" style="margin-top:12px">Favored</div>' : ''}
        <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);font-weight:700">${prob1}% win prob</div>
        ${histRecord}
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
        <div class="h2h-stats">${statRows(a2, a1)}</div>
        ${!w1 ? '<div class="favored-badge" style="margin-top:12px">Favored</div>' : ''}
        <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);font-weight:700">${prob2}% win prob</div>
      </div>
    </div>
  `;
}
