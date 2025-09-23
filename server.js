// server.js
const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 10000;

// --- CONFIG ---
const TIKTOK_USERNAME = "mykestradesbrainrots"; // Tu usuario sin @
const TIKTOK_RETRY_MS = 30_000; // Reintento si está offline

// --- Estado global ---
let state = {
  participants: {},
  recentDonations: [],
  timer: { remaining: 60, delay: 10, inDelay: false, delayRemaining: null },
  theme: 'gamer',
  running: false
};

let overlayInfo = { delayText: 'Delay 10 Segundos', minimoText: 'Sin mínimo' };
let history = [];
let interval = null;
let delayInterval = null;

// === Rutas para Render ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// === Helper: obtener avatar ===
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\\u0026/g, '&') : null;
  } catch {
    return null;
  }
}

function emitState() {
  io.emit('state', state);
}

function registerDonation(username, coins, avatar) {
  if (!state.running) {
    console.log(`⏸ Donación ignorada (subasta no activa): ${username} → ${coins}`);
    return;
  }

  if (!state.participants[username]) state.participants[username] = 0;
  state.participants[username] += coins;

  state.recentDonations.unshift({ username, coins, avatar: avatar || null });
  if (state.recentDonations.length > 20) state.recentDonations.pop();

  emitState();
}

// === Subasta ===
function startAuction(duration = 60, delay = 10) {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.timer.remaining = duration;
  state.timer.delay = delay;
  state.timer.inDelay = false;
  state.timer.delayRemaining = null;
  state.participants = {};
  state.recentDonations = [];
  state.running = true;

  emitState();

  interval = setInterval(() => {
    state.timer.remaining--;
    if (state.timer.remaining <= 0) {
      clearInterval(interval);
      startDelay();
    }
    emitState();
  }, 1000);

  console.log(`⏳ Subasta iniciada: ${duration}s + ${delay}s delay`);
}

function startDelay() {
  state.timer.inDelay = true;
  let remaining = state.timer.delay;
  state.timer.delayRemaining = remaining;
  io.emit('enterDelay');

  delayInterval = setInterval(() => {
    remaining--;
    state.timer.delayRemaining = remaining;
    if (remaining <= 0) {
      clearInterval(delayInterval);
      state.timer.inDelay = false;
      state.timer.delayRemaining = null;
      state.running = false;
      io.emit('delayEnd');
      endAuction();
    } else {
      emitState();
    }
  }, 1000);

  emitState();
}

function endAuction() {
  const sorted = Object.entries(state.participants).sort((a, b) => b[1] - a[1]);
  const winner = sorted.length ? { username: sorted[0][0], coins: sorted[0][1] } : null;

  const snapshot = {
    ts: new Date().toISOString(),
    winner,
    participants: { ...state.participants }
  };
  history.unshift(snapshot);
  if (history.length > 30) history.pop();

  io.emit('auctionEnd', { state, winner });
  emitState();
  console.log('🏆 Subasta finalizada. Ganador enviado al overlay.', winner);
}

// === Simulación manual ===
async function simulateDonation(username, coins) {
  console.log(`💰 Simulación: ${username} → ${coins}`);
  const avatar = await getTikTokAvatar(username);
  registerDonation(username, coins, avatar || null);
}

// === Socket.IO ===
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);
  socket.emit('updateInfo', overlayInfo);
  socket.emit('history', history);

  socket.on('admin:start', ({ duration, delay }) => startAuction(duration, delay));
  socket.on('admin:stop', () => {
    clearInterval(interval);
    clearInterval(delayInterval);
    state.running = false;
    endAuction();
  });
  socket.on('admin:reset', () => {
    clearInterval(interval);
    clearInterval(delayInterval);
    state = {
      participants: {},
      recentDonations: [],
      timer: { remaining: 60, delay: 10, inDelay: false, delayRemaining: null },
      theme: state.theme,
      running: false
    };
    io.emit('state', state);
    console.log('🔄 Subasta reiniciada manualmente.');
  });
  socket.on('admin:simulate', async ({ username, coins }) => simulateDonation(username, coins));
  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
  });
  socket.on('admin:updateInfo', (data) => {
    overlayInfo = data;
    io.emit('updateInfo', overlayInfo);
    console.log('ℹ️ updateInfo', data);
  });
});

// === TikTok Live ===
let tiktokConn = null;
async function connectTikTok() {
  try {
    if (tiktokConn) {
      try { tiktokConn.disconnect(); } catch (e) {}
      tiktokConn = null;
    }

    console.log(`🔌 Intentando conectar a TikTok Live @${TIKTOK_USERNAME} ...`);
    tiktokConn = new WebcastPushConnection(TIKTOK_USERNAME);

    await tiktokConn.connect();
    console.log(`✅ Conectado a TikTok Live para @${TIKTOK_USERNAME}`);

    // Evento de regalo
    tiktokConn.on('gift', async (data) => {
      try {
        if (data.giftType === 1 && !data.repeatEnd) return; // Evita doble conteo

        const username = data.uniqueId || 'unknown';
        const coins = data.diamondCount || data.repeatCount || 0;

        let avatar = data.profilePictureUrl && data.profilePictureUrl.trim() !== '' ? data.profilePictureUrl : null;
        registerDonation(username, coins, avatar);

        console.log(`💎 Donación procesada: ${username} → ${coins}`);
      } catch (err) {
        console.error('Error manejando gift:', err);
      }
    });

    tiktokConn.on('error', (err) => {
      console.error('TikTok conn error:', err.message || err);
    });

    tiktokConn.on('close', (reason) => {
      console.log('TikTok connection closed:', reason);
      setTimeout(connectTikTok, TIKTOK_RETRY_MS);
    });
  } catch (err) {
    console.error('Error conectando a TikTok:', err.message || err);
    setTimeout(connectTikTok, TIKTOK_RETRY_MS);
  }
}

connectTikTok().catch(e => console.error('connectTikTok failed:', e));

// Iniciar servidor
server.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
