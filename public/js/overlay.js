// public/js/overlay.js
// Conexion robusta al mismo origen
const socket = io.connect(window.SOCKET_IO_ORIGIN || window.location.origin);

// Elementos
const infoDelayEl = document.getElementById('info-delay');
const infoMinimoEl = document.getElementById('info-minimo');
const timerEl = document.getElementById('auction-timer');
const rankingEl = document.getElementById('ranking');
const vsLeft = document.getElementById('vs-left');
const vsRight = document.getElementById('vs-right');
const vsLeftCoins = document.getElementById('vs-left-coins');
const vsRightCoins = document.getElementById('vs-right-coins');
const winnerScreen = document.getElementById('winnerScreen');
const winnerTitle = document.getElementById('winnerTitle');
const winnerCoins = document.getElementById('winnerCoins');
const winnerAvatarImg = document.querySelector('#winnerAvatar img');

function formatTime(sec){
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60).toString().padStart(2,'0');
  const s = (sec % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function findAvatar(username, recent){
  if (!recent) return '/assets/avatar-placeholder.png';
  const f = recent.find(r => r.username === username);
  return f ? f.avatar : '/assets/avatar-placeholder.png';
}

function renderTimer(state){
  if (state.timer.inDelay){
    const dr = state.timer.delayRemaining ?? state.timer.delay;
    timerEl.textContent = `Delay: ${dr}s`;
    timerEl.classList.add('blink');
  } else {
    const t = state.timer.remaining ?? 0;
    timerEl.textContent = formatTime(t);
    if (t <= 10) timerEl.classList.add('blink'); else timerEl.classList.remove('blink');
  }
}

function renderRanking(participants, recentDonations){
  rankingEl.innerHTML = '<div class="ranking-title">🏆 Top Donadores</div>';
  const sorted = Object.entries(participants||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
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
      <div style="display:flex;align-items:center;gap:12px">
        <div class="coins">${coins} 💰</div>
        <div class="medal">${medals[idx]||''}</div>
      </div>
    `;
    rankingEl.appendChild(div);
  });
}

function renderVS(participants){
  const sorted = Object.entries(participants||{}).sort((a,b)=>b[1]-a[1]).slice(0,2);
  if (sorted[0]) { vsLeft.textContent = sorted[0][0]; vsLeftCoins.textContent = `${sorted[0][1]} 💰`; } else { vsLeft.textContent='—'; vsLeftCoins.textContent='0 💰'; }
  if (sorted[1]) { vsRight.textContent = sorted[1][0]; vsRightCoins.textContent = `${sorted[1][1]} 💰`; } else { vsRight.textContent='—'; vsRightCoins.textContent='0 💰'; }
}

function showWinner(username, coins, avatar){
  winnerTitle.textContent = `🎉 ¡Felicidades ${username}! 🎉`;
  winnerCoins.textContent = `Donó ${coins} 💰`;
  if (avatar) winnerAvatarImg.src = avatar;
  winnerScreen.style.display = 'flex';
  // dura más tiempo para que se vea
  setTimeout(()=> winnerScreen.style.display = 'none', 8000);
}

// Socket events
socket.on('connect', ()=> console.log('Overlay conectado ✅'));
socket.on('disconnect', ()=> console.log('Overlay desconectado ❌'));

socket.on('state', (s) => {
  renderTimer(s);
  renderRanking(s.participants, s.recentDonations);
  renderVS(s.participants);
});

// Info texts
socket.on('updateInfo', (data) => {
  if (!data) return;
  infoDelayEl.textContent = `⚡ ${data.delayText || ''}`;
  infoMinimoEl.textContent = `💰 ${data.minimoText || ''}`;
});

socket.on('auctionEnd', (payload) => {
  try {
    const st = payload.state || payload;
    const sorted = Object.entries(st.participants||{}).sort((a,b)=>b[1]-a[1]);
    if (!sorted.length) return;
    const [username, coins] = sorted[0];
    const avatar = (st.recentDonations || []).find(d=>d.username===username)?.avatar;
    showWinner(username, coins, avatar);
  } catch(e){
    console.error('Error auctionEnd overlay:', e);
  }
});

socket.on('themeChange', (theme) => {
  const el = document.getElementById('theme-style');
  if (el) el.href = theme === 'femenino' ? '/css/style-femenino.css' : '/css/style-gamer.css';
});
