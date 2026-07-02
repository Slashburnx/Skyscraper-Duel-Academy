// ═══════════════════════════════════════════════════════════
// YGO SKYSCRAPER — BRACKET.JS
// ═══════════════════════════════════════════════════════════

const ROUND_NAMES = ['Round 1','Round 2','Quarterfinals','Semifinals','Final','Champion'];
let bracketSize = 8;

// ── Tab switcher ───────────────────────────────────────────
function switchBracketTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-view').style.display  = tab === 'view'  ? '' : 'none';
  document.getElementById('tab-setup').style.display = tab === 'setup' ? '' : 'none';
  if (tab === 'view')  renderBracket();
  if (tab === 'setup') renderSetup();
}

// ── Set bracket size ───────────────────────────────────────
function setBracketSize(n, btn) {
  bracketSize = n;
  document.querySelectorAll('#size-btns .filter-btn').forEach(b => b.classList.remove('sel'));
  btn.classList.add('sel');
}

// ── Setup: add player ──────────────────────────────────────
function addBracketPlayer() {
  const inp = document.getElementById('bp-inp');
  const val = inp.value.trim();
  if (!val) return;
  const players = getBracketPlayers();
  players.push(val);
  saveBracketPlayers(players);
  inp.value = '';
  renderSetup();
}

function removeBracketPlayer(idx) {
  const players = getBracketPlayers();
  players.splice(idx, 1);
  saveBracketPlayers(players);
  renderSetup();
}

// ── Import from roster ─────────────────────────────────────
function importRoster() {
  const names = getDuelists().slice(0, bracketSize).map(d => d.name);
  saveBracketPlayers(names);
  saveBracketWinners({});
  renderSetup();
  notify('✅ Roster imported — ' + names.length + ' duelists');
}

// ── Reset bracket ──────────────────────────────────────────
function resetBracket() {
  if (!confirm('Reset the bracket? All results will be lost.')) return;
  saveBracketPlayers([]);
  saveBracketWinners({});
  renderSetup();
  renderBracket();
  notify('Bracket reset');
}

// ── Render setup panel ─────────────────────────────────────
function renderSetup() {
  const players = getBracketPlayers();
  document.getElementById('bp-list').innerHTML = players.map((name, i) => `
    <span style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;
                 padding:4px 10px;font-size:0.78rem;display:inline-flex;align-items:center;gap:5px;">
      ${name}
      <button onclick="removeBracketPlayer(${i})"
        style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:0.85rem;line-height:1;">✕</button>
    </span>`).join('');
}

// ── Set winner ─────────────────────────────────────────────
function setWinner(matchKey, name) {
  const w = getBracketWinners();
  // Toggle: clicking the current winner deselects them
  if (w[matchKey] === name) {
    delete w[matchKey];
  } else {
    w[matchKey] = name;
  }
  saveBracketWinners(w);
  renderBracket();
}

// ── Render bracket ─────────────────────────────────────────
function renderBracket() {
  const disp    = document.getElementById('bracket-display');
  const players = getBracketPlayers();

  if (players.length < 2) {
    disp.innerHTML = `
      <div class="empty-state">
        <div class="icon">🏆</div>
        <p>Add at least 2 duelists in the Setup tab to generate a bracket.</p>
      </div>`;
    return;
  }

  // Pad to next power of 2
  const padded = [...players];
  let sz = 2;
  while (sz < padded.length) sz *= 2;
  while (padded.length < sz) padded.push('BYE');

  const winners = getBracketWinners();

  // Build all rounds
  const rounds  = [];
  let current   = [...padded];
  while (current.length > 0) {
    rounds.push([...current]);
    if (current.length === 1) break;
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const key = `${rounds.length - 1}-${i / 2}`;
      next.push(winners[key] || 'TBD');
    }
    current = next;
  }

  let html = '<div class="bracket-scroll"><div class="bracket">';

  rounds.forEach((round, ri) => {
    const isChamp = ri === rounds.length - 1;
    const label   = ROUND_NAMES[Math.min(ri, ROUND_NAMES.length - 2)] || `Round ${ri + 1}`;

    html += `<div class="b-round"><div class="b-round-title">${label}</div><div class="b-matches">`;

    if (isChamp) {
      const champion = round[0];
      html += `
        <div class="b-champ">
          <div class="b-champ-slot">
            ${champion && champion !== 'TBD' ? '🏆 ' + champion : 'TBD'}
          </div>
        </div>`;
    } else {
      for (let i = 0; i < round.length; i += 2) {
        const p1  = round[i]     || 'BYE';
        const p2  = round[i + 1] || 'BYE';
        const key = `${ri}-${i / 2}`;
        const w   = winners[key];

        const bye1 = p1 === 'BYE', tbd1 = p1 === 'TBD';
        const bye2 = p2 === 'BYE', tbd2 = p2 === 'TBD';

        const cls1 = `b-slot${w === p1 ? ' winner' : ''}${bye1 || tbd1 ? ' tbd' : ''}`;
        const cls2 = `b-slot${w === p2 ? ' winner' : ''}${bye2 || tbd2 ? ' tbd' : ''}`;

        const click1 = (!bye1 && !tbd1) ? `onclick="setWinner('${key}','${p1.replace(/'/g, "\\'")}')"` : '';
        const click2 = (!bye2 && !tbd2) ? `onclick="setWinner('${key}','${p2.replace(/'/g, "\\'")}')"` : '';

        html += `
          <div class="b-match">
            <div class="${cls1}" ${click1}>${p1}</div>
            <div class="${cls2}" ${click2}>${p2}</div>
          </div>`;
      }
    }

    html += `</div></div>`;
  });

  html += '</div></div>';
  disp.innerHTML = html;
}

// ── Re-render on admin toggle ──────────────────────────────
function onAdminChange() { renderBracket(); }

// ── Init ──────────────────────────────────────────────────
injectNav('bracket.html');
renderBracket();
renderSetup();