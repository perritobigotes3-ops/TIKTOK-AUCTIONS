
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const axios = require('axios');

const PORT = process.env.PORT || 3000;

let state = {
  participants: {}, 
  recentDonations: [],
  timer: { remaining: 60, delay: 10, inDelay: false },
  theme: 'gamer'
};

let interval = null;
let delayInterval = null;

const path = require('path');
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.send('Servidor Subasta Overlay activo 🚀');
});

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

function endAuction() {
  io.emit('auctionEnd', state);
}

function simulateDonation() {
  const names = ['Josh', 'Ana', 'Leo', 'Mia', 'Alex'];
  const randomUser = names[Math.floor(Math.random() * names.length)];
  const randomCoins = Math.floor(Math.random() * 50) + 10;

  getTikTokAvatar(randomUser).then(avatar => {
    if (!state.participants[randomUser]) state.participants[randomUser] = 0;
    state.participants[randomUser] += randomCoins;

    state.recentDonations.push({ username: randomUser, coins: randomCoins, avatar });
    if (state.recentDonations.length > 10) state.recentDonations.shift();

    io.emit('state', state);
  });
}

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

  socket.on('admin:simulate', () => {
    simulateDonation();
  });

  socket.on('admin:theme', (theme) => {
    state.theme = theme;
    io.emit('themeChange', theme);
  });
});

http.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
