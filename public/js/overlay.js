const socket = io();

// Elementos DOM
const snipeInfoEl = document.getElementById('snipe-info');
const minInfoEl = document.getElementById('min-info');
const timerEl = document.getElementById('auction-timer');
const rankingEl = document.getElementById('ranking');
const vsLeft = document.getElementById('vs-left');
const vsRight = document.getElementById('vs-right');
const vsLeftCoins = document.getElementById('vs-left-coins');
const vsRightCoins = document.getElementById('vs-right-coins');

// Formato de tiempo
function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// Ranking
function renderRanking(participants, recentDonations) {
  rankingEl.innerHTML = '<div class="ranking-title">🏆 Top Donadores</div>';
  const sorted = Object.entries(participants || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];

  sorted.forEach(([username, coins], idx) => {
    const avatar = recentDonations.find(d => d.username === username)?.avatar || '/assets/avatar-placeholder.png';
    const div = document.createElement('div');
    div.className = 'participant';
    div.innerHTML = `
      <div class="left">
        <div class="avatar"><img src="${avatar}" alt="${username}"></div>
        <div class="name">${username}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <div class="coins">${coins} 💰</div>
        <div class="medal">${medals[idx]}</div>
      </div>
    `;
    rankingEl.appendChild(div);
  });
}

// VS dinámico
function renderVS(participants) {
  const sorted = Object.entries(participants || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  if (sorted[0]) {
    vsLeft.textContent = sorted[0][0];
    vsLeftCoins.textContent = `${sorted[0][1]} 💰`;
  } else {
    vsLeft.textContent = '—';
    vsLeftCoins.textContent = `0 💰`;
  }

  if (sorted[1]) {
    vsRight.textContent = sorted[1][0];
    vsRightCoins.textContent = `${sorted[1][1]} 💰`;
  } else {
    vsRight.textContent = '—';
    vsRightCoins.textContent = `0 💰`;
  }
}

// Estado en tiempo real
socket.on('state', (state) => {
  // Texto informativo
  snipeInfoEl.textContent = state.infoText?.snipe || '';
  minInfoEl.textContent = state.infoText?.min || '';

  // Contador
  timerEl.textContent = state.timer.inDelay
    ? `Delay: ${state.timer.delayRemaining ?? state.timer.delay}`
    : formatTime(state.timer.remaining);

  // Ranking y VS
  renderRanking(state.participants, state.recentDonations);
  renderVS(state.participants);
});
