const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');

const PORT = process.env.PORT || 3000;

// ============================
// Estado inicial
// ============================
let state = {
  participants: {},
  recentDonations: [],
  timer: {
    remaining: 60,
    delay: 10,
    delayRemaining: 0,
    inDelay: false,
    isRunning: false // <-- NUEVO: subasta activa/finalizada
  },
  theme: 'gamer'
};

let interval = null;
let delayInterval = null;

// ============================
// Servir carpeta "public"
// ============================
app.use(express.static(path.join(__dirname, 'public')));

// Ruta base
app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

// ============================
// Obtener avatar de TikTok
// ============================
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

// ============================
// Iniciar subasta
// ============================
function startAuction(duration, delay) {
  clearInterval(interval);
  clearInterval(delayInterval);

  state.timer.remaining = duration;
  state.timer.delay = delay;
  state.timer.delayRemaining = delay;
  state.participants = {};
  state.recentDonations = [];
  state.timer.inDelay = false;
  state.timer.isRunning = true; // <-- SUBASTA ACTIVA

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

// ============================
// Delay antes de mostrar ganador
// ============================
function startDelay() {
  state.timer.inDelay = true;
  state.timer.delayRemaining = state.timer.delay;

  io.emit('enterDelay');

  delayInterval = setInterval(() => {
    state.timer.delayRemaining--;

    if (state.timer.delayRemaining <= 0) {
      clearInterval(delayInterval);
      state.timer.inDelay = false;
      io.emit('delayEnd');
      endAuction();
    }

    io.emit('state', state);
  }, 1000);
}

// ============================
// Finalizar subasta
// ============================
function endAuction() {
  state.timer.isRunning = false; // <-- BLOQUEAR MÁS DONACIONES
  io.emit('auctionEnd', state);
  console.log('🏆 Subasta finalizada. Ganador enviado al overlay.');
}

// ============================
// Simulación de donación
// ============================
function simulateDonation(username, coins) {
  // 🚫 Bloquear si la subasta no está activa
  if (!state.timer.isRunning) {
    console.log(`❌ Donación ignorada: Subasta finalizada (${username} - ${coins} monedas)`);
    return;
  }

  console.log(`💰 Simulación recibida: ${username} donó ${coins} monedas`);

  getTikTokAvatar(username).then(avatar => {
    if (!state.participants[username]) state.participants[username] = 0;
    state.participants[username] += coins;

    state.recentDonations.push({ username, coins, avatar });
    if (state.recentDonations.length > 10) state.recentDonations.shift();

    io.emit('state', state);
  });
}

// ============================
// Manejo de conexiones socket.io
// ============================
io.on('connection', (socket) => {
  console.log('Cliente conectado ✅');
  socket.emit('state', state);

  // Iniciar subasta
  socket.on('admin:start', ({ duration, delay }) => {
    console.log("📢 Iniciando subasta con duración:", duration, "delay:", delay);
    startAuction(duration, delay);
  });

  // Detener subasta manualmente
  socket.on('admin:stop', () => {
    console.log("🛑 Subasta detenida manualmente");
    clearInterval(interval);
    clearInterval(delayInterval);
    endAuction();
  });

  // Simular donación
  socket.on('admin:simulate', ({ username, coins }) => {
    simulateDonation(username, coins);
  });

  // Cambiar tema
  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
  });

  // Reiniciar subasta a estado limpio
  socket.on('admin:reset', () => {
    console.log("🔄 Subasta reiniciada manualmente.");
    clearInterval(interval);
    clearInterval(delayInterval);

    state = {
      participants: {},
      recentDonations: [],
      timer: {
        remaining: 60,
        delay: 10,
        delayRemaining: 0,
        inDelay: false,
        isRunning: false
      },
      theme: state.theme
    };

    io.emit('state', state);
  });
});

// ============================
// Iniciar servidor
// ============================
http.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
