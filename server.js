const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ===== Estado global =====
let state = {
  participants: {},
  recentDonations: [],
  timer: { remaining: 60, delay: 10, inDelay: false },
  theme: 'gamer',
  history: []
};

let interval = null;
let delayInterval = null;

// ===== Servir carpeta public =====
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// ===== Obtener avatar TikTok =====
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\u0026/g, '&') : '/assets/avatar-placeholder.png';
  } catch {
    return '/assets/avatar-placeholder.png';
  }
}

// ===== Iniciar subasta =====
function startAuction(duration, delay) {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.timer.remaining = duration;
  state.timer.delay = delay;
  state.participants = {};
  state.recentDonations = [];
  state.timer.inDelay = false;

  io.emit('state', state);

  interval = setInterval(() => {
    state.timer.remaining--;

    if (state.timer.remaining <= 0) {
      clearInterval(interval);
      startDelay();
    }

    io.emit('state', state);
  }, 1000);
}

// ===== Delay final =====
function startDelay() {
  state.timer.inDelay = true;
  let delayRemaining = state.timer.delay;

  io.emit('enterDelay');

  delayInterval = setInterval(() => {
    delayRemaining--;

    if (delayRemaining <= 0) {
      clearInterval(delayInterval);
      state.timer.inDelay = false;
      io.emit('delayEnd');
      endAuction();
    }

    io.emit('state', { ...state, timer: { ...state.timer, delayRemaining } });
  }, 1000);
}

// ===== Finalizar subasta =====
function endAuction() {
  const sorted = Object.entries(state.participants || {}).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const [username, coins] = sorted[0];
    state.history.push({
      winner: username,
      coins,
      date: new Date().toLocaleString(),
      top3: sorted.slice(0, 3)
    });
  }
  io.emit('auctionEnd', state);
}

// ===== Reiniciar subasta =====
function resetAuction() {
  clearInterval(interval);
  clearInterval(delayInterval);
  state.participants = {};
  state.recentDonations = [];
  state.timer = { remaining: 60, delay: 10, inDelay: false };
  io.emit('state', state);
}

// ===== Simular donación =====
function simulateDonation(username, coins) {
  getTikTokAvatar(username).then(avatar => {
    if (!state.participants[username]) state.participants[username] = 0;
    state.participants[username] += coins;

    state.recentDonations.push({ username, coins, avatar });
    if (state.recentDonations.length > 10) state.recentDonations.shift();

    io.emit('state', state);
  });
}

// ===== WebSocket =====
io.on('connection', (socket) => {
  console.log('Cliente conectado');
  socket.emit('state', state);

  socket.on('admin:start', ({ duration, delay }) => {
    startAuction(duration, delay);
  });

  socket.on('admin:stop', () => {
    clearInterval(interval);
    clearInterval(delayInterval);
    endAuction();
  });

  socket.on('admin:reset', () => {
    resetAuction();
  });

  socket.on('admin:simulate', ({ username, coins }) => {
    simulateDonation(username, coins);
  });

  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
  });

  socket.on('admin:getHistory', () => {
    socket.emit('history', state.history);
  });
});

http.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
