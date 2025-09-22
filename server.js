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

const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const TIKTOK_USERNAME = "mykestradesbrainrots"; // <-- tu usuario sin @
const TIKTOK_RETRY_MS = 30_000; // reintento si está offline

// --- Estado global ---
let state = {
  participants: {},           // { username: coins }
  recentDonations: [],        // [{username, coins, avatar}]
  timer: { remaining: 60, delay: 10, inDelay: false, delayRemaining: null },
  theme: 'gamer',
  running: false
};

let overlayInfo = { delayText: 'Delay 10 Segundos', minimoText: 'Sin mínimo' };
let history = []; // historial de subastas

let interval = null;
let delayInterval = null;

// Servir carpeta public (html, css, js, assets)
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.send('Servidor Subasta Overlay activo 🚀'));

// ---- Helpers ----
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\\u0026/g, '&') : null; // <-- null si no hay avatar
  } catch (err) {
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

  state.recentDonations.unshift({ username, coins, avatar });
  if (state.recentDonations.length > 20) state.recentDonations.pop();

  emitState();
}

// ---- Subasta ----
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

// ---- Simulación (panel) ----
async function simulateDonation(username, coins) {
  console.log(`💰 Simulación: ${username} → ${coins}`);
  const avatar = await getTikTokAvatar(username);
  registerDonation(username, coins, avatar);
}

// ---- Socket.IO ----
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);
  socket.emit('updateInfo', overlayInfo);
  socket.emit('history', history);

  socket.on('admin:start', ({ duration, delay }) => startAuction(duration, delay));
  socket.on('admin:stop', () => {
    clearInterval(interval); clearInterval(delayInterval);
    state.running = false;
    endAuction();
  });
  socket.on('admin:reset', () => {
    clearInterval(interval); clearInterval(delayInterval);
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
  socket.on('admin:theme', (theme) => { state.theme = theme; io.emit('themeChange', theme); });
  socket.on('admin:updateInfo', (data) => {
    overlayInfo = data;
    io.emit('updateInfo', overlayInfo);
    console.log('ℹ️ updateInfo', data);
  });
});

// ---- TikTok Live Connector ----
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

    tiktokConn.on('gift', async (data) => {
      try {
        const username = data.uniqueId || data.user_id || 'unknown';
        const coins = data.diamondCount || data.repeatCount || 0;
        console.log(`💎 Donación en vivo: ${username} → ${coins}`);

        // 🔥 Si no tiene avatar, enviamos null para que el overlay muestre el emoji
        let avatar = data.profilePictureUrl && data.profilePictureUrl.trim() !== ''
          ? data.profilePictureUrl
          : null;

        if (!avatar) {
          console.log(`⚠️ Usuario ${username} sin avatar, se mostrará emoji 🔥`);
        }

        registerDonation(username, coins, avatar);
      } catch (err) {
        console.error('Error manejando gift:', err);
      }
    });

    tiktokConn.on('error', (err) => {
      console.error('TikTok conn error:', err && err.message ? err.message : err);
    });

    tiktokConn.on('close', (reason) => {
      console.log('TikTok connection closed:', reason);
      setTimeout(connectTikTok, TIKTOK_RETRY_MS);
    });

  } catch (err) {
    console.error('Error conectando a TikTok:', err && err.message ? err.message : err);
    setTimeout(connectTikTok, TIKTOK_RETRY_MS);
  }
}

connectTikTok().catch(e => console.error('connectTikTok failed:', e));

// ---- Start server ----
server.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
