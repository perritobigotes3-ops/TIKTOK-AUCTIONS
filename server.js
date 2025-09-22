const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// ===== TU USUARIO DE TIKTOK =====
const tiktokUsername = "mykestradesbrainrots"; // Sin @

// ===== Estado inicial =====
let state = {
  participants: {},
  recentDonations: [],
  timer: { remaining: 60, delay: 10, inDelay: false },
  theme: 'gamer',
  running: false
};

let interval = null;
let delayInterval = null;

// Servir carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta base
app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// Obtener avatar TikTok
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\\u0026/g, '&') : '/assets/avatar-placeholder.png';
  } catch {
    return '/assets/avatar-placeholder.png';
  }
}

// Registrar donación
function registerDonation(username, coins, avatar) {
  if (!state.running) {
    console.log(`⏸ Donación ignorada (subasta no activa): ${username} → ${coins}`);
    return;
  }

  if (!state.participants[username]) state.participants[username] = 0;
  state.participants[username] += coins;

  state.recentDonations.push({ username, coins, avatar });
  if (state.recentDonations.length > 10) state.recentDonations.shift();

  io.emit('state', state);
}

// ===== Subasta =====
function startAuction(duration, delay) {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.timer.remaining = duration;
  state.timer.delay = delay;
  state.participants = {};
  state.recentDonations = [];
  state.timer.inDelay = false;
  state.running = true;

  io.emit('state', state);

  interval = setInterval(() => {
    state.timer.remaining--;

    if (state.timer.remaining <= 0) {
      clearInterval(interval);
      startDelay();
    }

    io.emit('state', state);
  }, 1000);

  console.log(`⏳ Subasta iniciada: ${duration}s + ${delay}s de delay`);
}

function startDelay() {
  state.timer.inDelay = true;
  let delayRemaining = state.timer.delay;

  io.emit('enterDelay');

  delayInterval = setInterval(() => {
    delayRemaining--;

    if (delayRemaining <= 0) {
      clearInterval(delayInterval);
      state.timer.inDelay = false;
      state.running = false;
      io.emit('delayEnd');
      endAuction();
    }

    io.emit('state', { ...state, timer: { ...state.timer, delayRemaining } });
  }, 1000);
}

function endAuction() {
  io.emit('auctionEnd', state);
  console.log('🏆 Subasta finalizada. Ganador enviado al overlay.');
}

function resetAuction() {
  clearInterval(interval);
  clearInterval(delayInterval);

  state = {
    participants: {},
    recentDonations: [],
    timer: { remaining: 60, delay: 10, inDelay: false },
    theme: state.theme,
    running: false
  };

  io.emit('state', state);
  console.log('🔄 Subasta reiniciada manualmente.');
}

// Simular donación desde el panel
function simulateDonation(username, coins) {
  console.log(`💰 Simulación recibida: ${username} donó ${coins} monedas`);
  getTikTokAvatar(username).then(avatar => {
    registerDonation(username, coins, avatar);
  });
}

// ===== Socket.IO =====
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);

  socket.on('admin:start', ({ duration, delay }) => startAuction(duration, delay));
  socket.on('admin:stop', () => {
    clearInterval(interval);
    clearInterval(delayInterval);
    state.running = false;
    endAuction();
  });
  socket.on('admin:reset', resetAuction);
  socket.on('admin:simulate', ({ username, coins }) => simulateDonation(username, coins));
  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
  });
});

// ===== TikTok Live Connector =====
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
  console.log(`✅ Conectado a TikTok Live para @${tiktokUsername}`);
}).catch(err => {
  console.error("❌ Error conectando a TikTok:", err);
});

tiktokLiveConnection.on('gift', data => {
  const username = data.uniqueId;
  const coins = data.diamondCount;

  console.log(`💎 Donación en vivo: ${username} → ${coins} monedas`);

  getTikTokAvatar(username).then(avatar => {
    registerDonation(username, coins, avatar);
  });
});

// ===== Iniciar servidor =====
server.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
