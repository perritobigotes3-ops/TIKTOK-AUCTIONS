const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');

const PORT = process.env.PORT || 3000;

// Estado inicial
let state = {
  participants: {}, 
  recentDonations: [],
  timer: {
    remaining: 60,
    delay: 10,
    delayRemaining: 0,
    inDelay: false,
    isRunning: false
  },
  theme: 'gamer', // 'gamer' -> navy, 'femenino' -> black
  infoText: { snipe: '⚡ 10 SEGUNDOS SNIPE !!', min: '💰 MÍNIMO 0 PUNTOS' },
  lastWinner: null
};

let interval = null;
let delayInterval = null;

// Servir carpeta public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// Obtener avatar de TikTok (fallback a placeholder)
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\u0026/g, '&') : '/assets/avatar-placeholder.png';
  } catch (err) {
    return '/assets/avatar-placeholder.png';
  }
}

// Iniciar subasta
function startAuction(duration, delay) {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.timer.remaining = duration;
  state.timer.delay = delay;
  state.timer.delayRemaining = delay;
  state.participants = {};
  state.recentDonations = [];
  state.timer.inDelay = false;
  state.timer.isRunning = true;
  state.lastWinner = null;

  io.emit('state', state);

  interval = setInterval(() => {
    if (state.timer.remaining > 0) state.timer.remaining--;

    if (state.timer.remaining <= 0) {
      clearInterval(interval);
      startDelay();
    }

    io.emit('state', state);
  }, 1000);

  console.log(`⏳ Subasta iniciada: ${duration}s + ${delay}s de delay`);
}

// Start delay
function startDelay() {
  state.timer.inDelay = true;
  state.timer.delayRemaining = state.timer.delay;

  io.emit('enterDelay');

  delayInterval = setInterval(() => {
    if (state.timer.delayRemaining > 0) state.timer.delayRemaining--;

    if (state.timer.delayRemaining <= 0) {
      clearInterval(delayInterval);
      state.timer.inDelay = false;
      io.emit('delayEnd');
      endAuction();
    }

    io.emit('state', state);
  }, 1000);
}

// Finalizar subasta
function endAuction() {
  // Calcular ganador
  const sorted = Object.entries(state.participants || {}).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    state.lastWinner = null;
    state.timer.isRunning = false;
    io.emit('auctionEnd', { winner: null, state });
    io.emit('state', state);
    console.log('🏁 Subasta finalizada sin donadores.');
    return;
  }

  const [username, coins] = sorted[0];
  const avatar = state.recentDonations.find(d => d.username === username)?.avatar || '/assets/avatar-placeholder.png';

  state.lastWinner = { username, coins, avatar };
  state.timer.isRunning = false;

  // Emitir evento con información del ganador
  io.emit('auctionEnd', { winner: state.lastWinner, state });
  io.emit('state', state);

  console.log(`🏆 Subasta finalizada. Ganador: ${username} → ${coins} monedas`);
}

// Simular donación (bloqueada si subasta finalizó)
function simulateDonation(username, coins) {
  if (!state.timer.isRunning) {
    console.log(`❌ Donación ignorada (subasta cerrada): ${username} → ${coins}`);
    return;
  }

  console.log(`💰 Simulación: ${username} donó ${coins} monedas`);

  getTikTokAvatar(username).then(avatar => {
    if (!state.participants[username]) state.participants[username] = 0;
    state.participants[username] += coins;

    state.recentDonations.push({ username, coins, avatar });
    if (state.recentDonations.length > 30) state.recentDonations.shift();

    io.emit('state', state);
  });
}

// Reseteo completo (reiniciar subasta)
function resetAuction() {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.participants = {};
  state.recentDonations = [];
  state.timer = {
    remaining: 60,
    delay: 10,
    delayRemaining: 0,
    inDelay: false,
    isRunning: false
  };
  state.lastWinner = null;

  io.emit('state', state);
  console.log('🔄 Subasta reiniciada (limpio puntos y donadores).');
}

// Manejo de sockets
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);

  socket.on('admin:start', ({ duration, delay }) => {
    startAuction(duration, delay);
  });

  socket.on('admin:stop', () => {
    clearInterval(interval);
    clearInterval(delayInterval);
    // Forzamos final
    endAuction();
  });

  socket.on('admin:simulate', ({ username, coins }) => {
    simulateDonation(username, coins);
  });

  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
    io.emit('state', state);
  });

  socket.on('admin:updateInfo', (info) => {
    state.infoText = info || { snipe: '', min: '' };
    io.emit('state', state);
    console.log('ℹ️ Texto informativo actualizado:', state.infoText);
  });

  socket.on('admin:reset', () => {
    resetAuction();
  });
});

http.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
