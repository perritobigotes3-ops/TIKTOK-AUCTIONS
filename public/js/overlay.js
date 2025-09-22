const socket = io();

const timerEl = document.getElementById('auction-timer');
const rankingEl = document.getElementById('ranking');
const vsLeft = document.getElementById('vs-left');
const vsRight = document.getElementById('vs-right');
const vsLeftCoins = document.getElementById('vs-left-coins');
const vsRightCoins = document.getElementById('vs-right-coins');

const winnerScreen = document.getElementById('winnerScreen');
const winnerTitle = document.getElementById('winnerTitle');
const winnerCoins = document.getElementById('winnerCoins');
const winnerAvatar = document.querySelector('#winnerAvatar img');

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function findAvatar(username, recent) {
  if (!recent) return '/assets/avatar-placeholder.png';
  const found = recent.find(d => d.username === username);
  return found?.avatar || '/assets/avatar-placeholder.png';
}

function renderTimer(state) {
  const timer = state.timer?.remaining ?? 0;

  if (state.timer.inDelay) {
    timerEl.textContent = `Delay: ${state.timer.delayRemaining ?? state.timer.delay}`;
    timerEl.classList.add('blink');
  } else {
    timerEl.textContent = formatTime(timer);
  }
}

function renderRanking(participants, recentDonations) {
  rankingEl.innerHTML = '<div class="ranking-title">🏆 Top Donadores</div>';

  const sorted = Object.entries(participants || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const medals = ['🥇', '🥈', '🥉'];

  sorted.forEach(([username, coins], idx) => {
    const avatar = findAvatar(username, recentDonations);
    const div = document.createElement('div');
    div.className = 'participant';
    div.innerHTML = `
      <div class="left">
        <div class="avatar"><img src="${avatar}" alt="${username}"></div>
        <div class="name">${username}</div>
      </div>
      <div style="display:flex;align-items:center;gap:15px">
        <div class="coins">${coins} 💰</div>
        <div class="medal">${medals[idx]}</div>
      </div>`;
    rankingEl.appendChild(div);
  });
}

function renderVS(participants) {
  const sorted = Object.entries(participants || {}).sort((a, b) => b[1] - a[1]).slice(0, 2);

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

function showWinner(username, coins, avatarUrl) {
  winnerTitle.textContent = `🎉 ¡Felicidades ${username}! 🎉`;
  winnerCoins.textContent = `Donó ${coins} 💰`;
  winnerAvatar.src = avatarUrl || '/assets/avatar-placeholder.png';
  winnerScreen.style.display = 'flex';

  setTimeout(() => {
    winnerScreen.style.display = 'none';
  }, 8000);
}

socket.on('state', (state) => {
  renderTimer(state);
  renderRanking(state.participants, state.recentDonations);
  renderVS(state.participants);
});

socket.on('auctionEnd', (state) => {
  const sorted = Object.entries(state.participants || {}).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return;
  const [username, coins] = sorted[0];
  const avatarUrl = state.recentDonations.find(d => d.username === username)?.avatar;
  showWinner(username, coins, avatarUrl);
});

socket.on('themeChange', (theme) => {
  document.getElementById('theme-style').href = theme === 'femenino'
    ? '/css/style-femenino.css'
    : '/css/style-gamer.css';
});
