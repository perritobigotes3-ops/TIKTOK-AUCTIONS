const socket = io();

// DOM
const snipeInfoEl = document.getElementById('snipe-info');
const minInfoEl = document.getElementById('min-info');
const timerEl = document.getElementById('auction-timer');
const rankingEl = document.getElementById('ranking');
const vsLeft = document.getElementById('vs-left');
const vsRight = document.getElementById('vs-right');
const vsLeftCoins = document.getElementById('vs-left-coins');
const vsRightCoins = document.getElementById('vs-right-coins');

const winnerScreen = document.getElementById('winnerScreen');
const winnerTitle = document.getElementById('winnerTitle');
const winnerAvatar = document.querySelector('#winnerAvatar img');
const winnerCoins = document.getElementById('winnerCoins');
const confettiContainer = document.getElementById('confettiContainer');

let confettiTimeout = null;

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

function renderRanking(participants, recentDonations) {
  rankingEl.innerHTML = '<div class="ranking-title">🏆 Top Donadores</div>';
  const sorted = Object.entries(participants || {}).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const medals = ['🥇','🥈','🥉'];

  sorted.forEach(([username, coins], idx) => {
    const avatar = findAvatar(username, recentDonations);
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

function renderVS(participants) {
  const sorted = Object.entries(participants || {}).sort((a,b)=>b[1]-a[1]).slice(0,2);
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

function clearConfetti() {
  confettiContainer.innerHTML = '';
  if (confettiTimeout) { clearTimeout(confettiTimeout); confettiTimeout = null; }
}

function spawnConfetti(count = 24) {
  clearConfetti();
  const colors = ['#ff3b3b','#ffd700','#ff7a00','#ff66b2','#66ffcc'];
  const width = window.innerWidth;
  for (let i=0;i<count;i++){
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = `${Math.random()*100}%`;
    el.style.top = `${-Math.random()*20}%`;
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.transform = `rotate(${Math.random()*360}deg)`;
    el.style.animationDuration = `${2 + Math.random()*2.5}s`;
    el.style.animationDelay = `${Math.random()*0.5}s`;
    confettiContainer.appendChild(el);
  }
  // auto clear after 8s
  confettiTimeout = setTimeout(clearConfetti, 8000);
}

function showWinnerCard(winner, durationMs = 8000) {
  if (!winner) {
    winnerTitle.textContent = '🎉 ¡Felicidades!';
    winnerAvatar.src = '/assets/avatar-placeholder.png';
    winnerCoins.textContent = 'Donó 0 💰';
  } else {
    winnerTitle.textContent = `🎉 ¡Felicidades ${winner.username}! 🎉`;
    winnerAvatar.src = winner.avatar || '/assets/avatar-placeholder.png';
    winnerCoins.textContent = `Donó ${winner.coins} 💰`;
  }

  // confetti
  spawnConfetti(28);

  winnerScreen.style.display = 'flex';
  winnerScreen.setAttribute('aria-hidden','false');

  setTimeout(() => {
    winnerScreen.style.display = 'none';
    winnerScreen.setAttribute('aria-hidden','true');
    clearConfetti();
  }, durationMs);
}

// Ajusta el fondo según tema
function applyTheme(theme) {
  if (theme === 'femenino') {
    document.body.style.background = '#000'; // negro
  } else {
    document.body.style.background = '#001f3f'; // azul marino
  }
}

// Eventos socket
socket.on('connect', () => console.log('Overlay conectado ✅'));
socket.on('disconnect', () => console.log('Overlay desconectado ❌'));

// Estado en tiempo real
socket.on('state', (state) => {
  // aplicar tema (navy / black)
  applyTheme(state.theme);

  // textos informativos
  snipeInfoEl.textContent = state.infoText?.snipe || '';
  minInfoEl.textContent = state.infoText?.min || '';

  // contador
  if (state.timer.inDelay) {
    timerEl.textContent = `Delay: ${state.timer.delayRemaining ?? state.timer.delay}`;
    timerEl.classList.add('blink');
  } else {
    timerEl.textContent = formatTime(state.timer.remaining ?? 0);
    if (state.timer.remaining <= 10) timerEl.classList.add('blink'); else timerEl.classList.remove('blink');
  }

  // ranking y vs
  renderRanking(state.participants, state.recentDonations);
  renderVS(state.participants);
});

// Cuando la subasta termina, recibimos ganador
socket.on('auctionEnd', (payload) => {
  // payload: { winner: { username, coins, avatar } , state }
  const winner = payload && payload.winner ? payload.winner : null;
  // mostrar animación del ganador (8s por defecto)
  showWinnerCard(winner, 8000);
});

// Cambio de tema en vivo
socket.on('themeChange', (theme) => applyTheme(theme));
