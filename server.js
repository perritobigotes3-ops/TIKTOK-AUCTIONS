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
const TIKTOK_USERNAME = "mykestradesbrainrots"; // <-- tu usuario de TikTok sin @
const TIKTOK_RETRY_MS = 30000; // 30 segundos para reintentar conexión

// --- Estado global ---
let state = {
  participants: {},
  recentDonations: [], // [{username, coins, avatar}]
  timer: { remaining: 60, delay: 10, inDelay: false, delayRemaining: null },
  theme: 'gamer',
  running: false
};

let overlayInfo = { delayText: 'Delay 10 Segundos', minimoText: 'Sin mínimo' };
let history = [];

let interval = null;
let delayInterval = null;

// ================================
// SERVIR ARCHIVOS ESTÁTICOS
// ================================
app.use(express.static(path.join(__dirname, 'public')));

// Página principal
app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// Ruta para el panel de administración
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta para el overlay
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

// Ruta para manejar 404
app.use((req, res) => {
  res.status(404).send('404 - Página no encontrada ❌');
});

// ================================
// FUNCIONES DE UTILIDAD
// ================================
async function getTikTokAvatar(username) {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    });
    const match = data.match(/"avatarLarger":"(.*?)"/);
    return match ? match[1].replace(/\\u0026/g, '&') : null;
  } catch (err) {
    return null; // Sin avatar
  }
}

function emitState() {
  io.emit('state', state);
}

// ================================
// REGISTRO DE DONACIONES
// ================================
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

// ================================
// SUBASTA
// ================================
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

// ================================
// SIMULACIÓN DE DONACIONES
// ================================
async function simulateDonation(username, coins) {
  console.log(`💰 Simulación: ${username} → ${coins}`);
  const avatar = await getTikTokAvatar(username);
  registerDonation(username, coins, avatar || null);
}

// ================================
// SOCKET.IO
// ================================
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);
  socket.emit('updateInfo', overlayInfo);
  socket.emit('history', history);

  // Eventos desde el admin
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
  socket.on('admin:theme', (theme) => { state.theme = theme; io.emit('themeChange', theme); });
  socket.on('admin:updateInfo', (data) => {
    overlayInfo = data;
    io.emit('updateInfo', overlayInfo);
    console.log('ℹ️ updateInfo', data);
  });
});

// ================================
// TIKTOK LIVE CONNECTOR
// ================================
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
        const coins = data.diamondCount || 0;

        if (!coins) return;

        console.log(`💎 Donación procesada: ${username} → ${coins}`);

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
      console.error('TikTok conn error:', err?.message || err);
    });

    tiktokConn.on('close', (reason) => {
      console.log('TikTok connection closed:', reason);
      setTimeout(connectTikTok, TIKTOK_RETRY_MS);
    });

  } catch (err) {
    console.error('Error conectando a TikTok:', err?.message || err);
    setTimeout(connectTikTok, TIKTOK_RETRY_MS);
  }
}

// Iniciar conexión con TikTok
connectTikTok().catch(e => console.error('connectTikTok failed:', e));

// ================================
// INICIAR SERVIDOR
// ================================
server.listen(PORT, () => console.log(`Servidor activo en puerto ${PORT}`));
