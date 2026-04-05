/* ─── Render Engine v2.0 ────────────────────────────────────────────────────── */
'use strict';

/* ── Championship year markers ───────────────────────────────────────────────
 * Key years and the major championship that took place in them.
 * These are shown as small star/medal markers above form bars.
 */
const CHAMPS_YEAR_LABEL = {
  2022: { icon: '🌍', tip: '2022 Worlds (Budapest)' },
  2023: { icon: '🌍', tip: '2023 Worlds (Fukuoka)' },
  2024: { icon: '🥇', tip: '2024 Olympics (Paris)' },
  2025: { icon: '🌍', tip: '2025 Worlds (Singapore)' },
};

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
  // Filter by competition eligibility (null = all countries allowed)
  const eligible = (typeof COMP_ELIGIBILITY !== 'undefined') ? COMP_ELIGIBILITY[comp] : null;
  const athletes = allAthletes.filter(a =>
    a.active !== false && (!eligible || eligible.has(a.country))
  );

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
        <div class="athlete-name">
          <span class="athlete-name-link" onclick="openProfile('${a.name.replace(/'/g,"\\'")}')">
            ${a.flag} ${a.name}
          </span>${badge}${champs}
        </div>
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

  // Retired athletes row (collapsed) — respect eligibility filter
  const retired = allAthletes.filter(a =>
    a.active === false && (!eligible || eligible.has(a.country))
  );
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
  const eligNote  = eligible ? ` · ${athletes.length} eligible nations` : '';
  document.getElementById('eventTitle').textContent = `${gLabel} ${dist}m ${cat === 'IM' ? 'Individual Medley' : cat}`;
  document.getElementById('eventSubtitle').textContent = `${comp} — Predicted Results${champsNote}${eligNote}`;

  return sorted;
}

/* ── Historical Form Charts ──────────────────────────────────────────────────── */
function renderFormCharts(sorted) {
  const container = document.getElementById('formCharts');
  container.innerHTML = '';
  const top5 = sorted.slice(0, 5);

  top5.forEach(a => {
    const hist = a.hist || {};
    const years = [2022, 2023, 2024, 2025, 2026];
    const times = years.map(y => hist[y] || null);
    const validTimes = times.filter(Boolean);
    if (!validTimes.length) return;

    const minT = Math.min(...validTimes);
    const maxT = Math.max(...validTimes);
    const range = maxT - minT || 1;

    const barsHtml = years.map((y, i) => {
      const t = times[i];
      const champInfo = CHAMPS_YEAR_LABEL[y];
      if (!t) return `<div class="form-year-col" style="margin-top:14px">
        <div class="form-bar" style="height:0"></div>
        <div class="form-year-label">${y}</div>
        <div class="form-time-label">—</div></div>`;
      const heightPct = 20 + ((maxT - t) / range) * 80;
      // Championship years get a gold tint; 2026 gets a teal tint (current season)
      const isChamp = !!champInfo;
      const is2026  = y === 2026;
      const hue = isChamp ? 42 : is2026 ? 185 : 180 + (i / 5) * 30;
      const sat = isChamp ? 90 : 80;
      const starHtml = champInfo
        ? `<span class="champs-star" title="${champInfo.tip}">${champInfo.icon}</span>`
        : '';
      return `
        <div class="form-year-col" style="margin-top:14px">
          ${starHtml}
          <div class="form-bar" style="height:${heightPct}%;background:hsl(${hue},${sat}%,${isChamp?52:48}%)${isChamp?' box-shadow:0 0 4px rgba(245,158,11,0.3)':''}"></div>
          <div class="form-year-label">${y}</div>
          <div class="form-time-label">${fmtTime(t)}</div>
        </div>`;
    }).join('');

    const trend = trendArrow(a);
    const div = document.createElement('div');
    div.className = 'form-athlete';
    div.innerHTML = `
      <div class="form-athlete-name">
        <span class="athlete-name-link" onclick="openProfile('${a.name.replace(/'/g,"\\'")}')">
          ${a.flag} ${a.name}
        </span>
        <span class="${trend.cls}" style="font-size:0.8rem">${trend.symbol}</span>
      </div>
      <div class="form-athlete-country">${a.country} · Age ${a.age} · Champs: ${champsIndicator(a) || '—'}</div>
      <div class="form-bars">${barsHtml}</div>
    `;
    container.appendChild(div);
  });

  // Championship legend
  const legend = document.createElement('div');
  legend.className = 'form-champs-legend';
  legend.innerHTML = `
    <span>🌍 World Championships</span>
    <span>🥇 Olympic Games</span>
    <span style="color:hsl(185,80%,48%)">■ 2026 current season</span>
    <span>Gold bars = championship year performance</span>
  `;
  container.appendChild(legend);
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
  const _comp2    = (window._appState || {}).comp || '';
  const _elig2    = (typeof COMP_ELIGIBILITY !== 'undefined') ? COMP_ELIGIBILITY[_comp2] : null;
  const athletes = (ATHLETES[key] || []).filter(a =>
    a.active !== false && (!_elig2 || _elig2.has(a.country))
  );
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

/* ─── Athlete Profile Modal ──────────────────────────────────────────────────── */

/* Build a human-readable event label from an ATHLETES key  (e.g. "W-Free-100") */
function eventKeyLabel(key) {
  const parts = key.split('-');
  const g = parts[0] === 'M' ? "Men's" : "Women's";
  const strMap = { Free: 'Freestyle', Back: 'Backstroke', Breast: 'Breaststroke', Fly: 'Butterfly', IM: 'Ind. Medley' };
  const stroke = strMap[parts[1]] || parts[1];
  const dist   = parts[2];
  return `${g} ${dist}m ${stroke}`;
}

/* Find every event an athlete competes in and return {key, eventLabel, athlete} pairs */
function findAthleteEvents(name) {
  const results = [];
  for (const [key, list] of Object.entries(ATHLETES)) {
    const a = list.find(x => x.name === name);
    if (a) results.push({ key, label: eventKeyLabel(key), athlete: a });
  }
  // Sort: women before men, freestyle first
  const order = ['Free', 'Back', 'Breast', 'Fly', 'IM'];
  results.sort((a, b) => {
    const ap = a.key, bp = b.key;
    if (ap[0] !== bp[0]) return ap[0] === 'W' ? -1 : 1;
    const ai = order.indexOf(ap.split('-')[1]);
    const bi = order.indexOf(bp.split('-')[1]);
    if (ai !== bi) return ai - bi;
    return parseInt(ap.split('-')[2]) - parseInt(bp.split('-')[2]);
  });
  return results;
}

/* Mini horizontal form bar strip for the profile event rows */
function miniFormBars(hist) {
  const years = [2022, 2023, 2024, 2025, 2026];
  const times = years.map(y => hist[y] || null);
  const valid  = times.filter(Boolean);
  if (!valid.length) return '';
  const minT = Math.min(...valid), maxT = Math.max(...valid);
  const range = maxT - minT || 1;
  return years.map((y, i) => {
    const t = times[i];
    if (!t) return `<div class="profile-mini-bar-col"><div class="profile-mini-bar" style="height:0px;background:transparent"></div><div class="profile-mini-year">${y}</div></div>`;
    const h = 8 + Math.round(((maxT - t) / range) * 28);
    const isChamp = !!CHAMPS_YEAR_LABEL[y];
    const is2026  = y === 2026;
    const bg = isChamp ? 'hsl(42,90%,52%)' : is2026 ? 'hsl(185,80%,48%)' : `hsl(${185 + i * 8},75%,46%)`;
    return `<div class="profile-mini-bar-col"><div class="profile-mini-bar" style="height:${h}px;background:${bg}"></div><div class="profile-mini-year">${String(y).slice(2)}</div></div>`;
  }).join('');
}

function openProfile(name) {
  const events = findAthleteEvents(name);
  if (!events.length) return;

  const first = events[0].athlete;

  /* Header */
  document.getElementById('profileName').textContent = `${first.flag} ${name}`;
  document.getElementById('profileMeta').textContent =
    `${first.country} · Age ${first.age}${first.note ? ' · ' + first.note : ''}`;

  /* Stat chips */
  const trend  = trendArrow(first);
  const champsHtml = champsIndicator(first) || '<span style="color:var(--text-muted)">neutral</span>';
  const chips = [
    { label: 'Age', val: first.age },
    { label: 'Trend', val: `<span class="${trend.cls}">${trend.symbol} ${trend.cls === 'trend-up' ? 'Improving' : trend.cls === 'trend-down' ? 'Declining' : 'Stable'}</span>` },
    { label: 'Champs', val: champsHtml },
    { label: 'Events', val: events.length },
  ].map(c => `<div class="profile-stat-chip"><div class="chip-label">${c.label}</div><div class="chip-val">${c.val}</div></div>`).join('');

  /* Event rows */
  const rows = events.map(({ key, label, athlete: a }) => {
    const mini = miniFormBars(a.hist || {});
    const trend2 = trendArrow(a);
    return `
      <div class="profile-event-row" onclick="jumpToEvent('${key}')" title="Jump to ${label}">
        <div class="profile-event-name">${label}</div>
        <div class="profile-event-times">
          <div><div class="profile-time-label">PB</div><strong>${fmtTime(a.pb)}</strong></div>
          <div><div class="profile-time-label">SB '26</div><strong style="color:var(--teal)">${fmtTime(a.sb)}</strong></div>
        </div>
        <div class="profile-mini-bars">${mini}</div>
        <span class="${trend2.cls}" style="font-size:0.9rem;margin-left:4px">${trend2.symbol}</span>
      </div>`;
  }).join('');

  /* H2H records if present */
  const h2hEntries = Object.entries(first.h2h || {});
  const h2hSection = h2hEntries.length ? `
    <div class="profile-events-title" style="margin-top:18px">Head-to-Head Records</div>
    ${h2hEntries.map(([opp, rec]) => {
      const tot = rec.wins + rec.losses;
      const pct = tot ? Math.round(rec.wins / tot * 100) : 0;
      return `<div class="profile-event-row" style="cursor:default">
        <div class="profile-event-name">vs ${opp}</div>
        <div class="profile-event-times">
          <div><div class="profile-time-label">Record</div><strong>${rec.wins}W – ${rec.losses}L</strong></div>
          <div><div class="profile-time-label">Win%</div><strong style="color:${pct>60?'var(--green)':pct<40?'var(--red)':'var(--text)'}">${pct}%</strong></div>
        </div>
      </div>`;
    }).join('')}` : '';

  document.getElementById('profileContent').innerHTML = `
    <div class="profile-stats">${chips}</div>
    <div class="profile-events-title">Events (${events.length})</div>
    ${rows}
    ${h2hSection}
    <div style="font-size:0.65rem;color:var(--text-muted);margin-top:16px;text-align:center">
      Click any event row to navigate to it. Gold bars = championship year. Teal bar = 2026.
    </div>
  `;

  document.getElementById('profileModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeProfile() {
  document.getElementById('profileModal').classList.remove('open');
  document.body.style.overflow = '';
}

/* Jump to a specific event from inside the profile modal */
function jumpToEvent(key) {
  closeProfile();
  const parts = key.split('-');
  const gender = parts[0];
  const strokeMap = { Free: 'Freestyle', Back: 'Backstroke', Breast: 'Breaststroke', Fly: 'Butterfly', IM: 'IM' };
  const cat  = strokeMap[parts[1]] || parts[1];
  const dist = parseInt(parts[2]);
  if (typeof setGender === 'function') setGender(gender);
  if (typeof setCat    === 'function') setCat(cat);
  if (typeof setDist   === 'function') setDist(dist);
}

/* Close on Escape key */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeProfile();
});
