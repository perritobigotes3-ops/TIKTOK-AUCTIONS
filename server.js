const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const TikTokLiveConnection = require('tiktok-live-connector').TikTokLiveConnection;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 10000;

// Estado de la subasta
let state = {
  running: false,
  duration: 60,
  delay: 10,
  participants: {},
  history: [],
  currentTimer: null,
  overlayInfo: {
    delayText: "⚡ Delay 10 Segundos",
    minimoText: "💰 Sin mínimo"
  }
};

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => res.send('Servidor Subasta Overlay activo 🚀'));

// Ruta para panel admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Ruta para overlay
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'overlay.html'));
});

// Conexión a TikTok Live
const tiktokUsername = process.env.TIKTOK_USERNAME || 'mykestradesbrainrots';
const tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername);

// --- Funciones de control ---
function resetAuction() {
  state.running = false;
  state.participants = {};
  clearTimeout(state.currentTimer);
  io.emit('auction:reset');
  console.log("🔄 Subasta reiniciada manualmente.");
}

function startAuction(duration = 60, delay = 10) {
  resetAuction();
  state.running = true;
  state.duration = duration;
  state.delay = delay;
  console.log(`⏳ Subasta iniciada: ${duration}s + ${delay}s delay`);

  io.emit('auction:start', { duration, delay });

  state.currentTimer = setTimeout(() => {
    state.running = false;
    endAuction();
  }, (duration + delay) * 1000);
}

function endAuction() {
  const winner = Object.entries(state.participants)
    .sort((a, b) => b[1] - a[1])[0];

  const result = winner
    ? { username: winner[0], coins: winner[1] }
    : null;

  state.history.push({ ts: Date.now(), winner: result });
  io.emit('auction:end', result);
  console.log(`🏆 Subasta finalizada. Ganador enviado al overlay.`, result);
}

// --- Eventos Socket.IO ---
io.on('connection', (socket) => {
  console.log("Cliente conectado ✅");

  // Iniciar subasta desde admin
  socket.on('admin:start', ({ duration, delay }) => startAuction(duration, delay));

  // Detener subasta
  socket.on('admin:stop', () => {
    state.running = false;
    clearTimeout(state.currentTimer);
    io.emit('auction:stop');
  });

  // Reiniciar subasta
  socket.on('admin:reset', resetAuction);

  // Simular donación
  socket.on('admin:simulate', ({ username, coins }) => {
    if (!state.running) {
      console.log(`⏸ Donación ignorada (subasta no activa): ${username} → ${coins}`);
      return;
    }
    processDonation(username, coins, true);
  });

  // Enviar historial
  socket.on('admin:getHistory', () => {
    socket.emit('history', state.history);
  });

  // Actualizar información de overlay
  socket.on('admin:updateInfo', (data) => {
    state.overlayInfo = data;
    io.emit('updateInfo', state.overlayInfo);
  });

  // Enviar info inicial
  socket.emit('updateInfo', state.overlayInfo);
});

// --- Procesar donaciones ---
function processDonation(username, coins, isSimulated = false) {
  if (!state.running) {
    console.log(`⏸ Donación ignorada (subasta no activa): ${username} → ${coins}`);
    return;
  }

  if (!username || !coins || coins <= 0) return;

  if (!state.participants[username]) {
    state.participants[username] = 0;
  }
  state.participants[username] += coins;

  io.emit('auction:update', { username, coins, total: state.participants[username] });

  const tag = isSimulated ? '💰 Simulación' : '💎 Donación procesada';
  console.log(`${tag}: ${username} → ${coins}`);
}

// --- Conectar a TikTok Live ---
tiktokLiveConnection.connect().catch(err => {
  console.error("Error conectando a TikTok:", err.message);
});

tiktokLiveConnection.on('gift', (data) => {
  if (!state.running) return;

  const { uniqueId, gift, repeatEnd } = data;

  if (gift.repeat_count > 1 && !repeatEnd) return;

  processDonation(uniqueId, gift.diamond_count);
});

// --- Iniciar servidor ---
server.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
