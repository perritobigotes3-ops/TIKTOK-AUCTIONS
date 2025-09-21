// server.js - Subastas estilo 14alls (Node.js + Socket.io)
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Optional TikTok connector (only used if TIKTOK_USERNAME set and library installed)
let tiktokAvailable = false;
let WebcastPushConnection = null;
try {
  WebcastPushConnection = require('tiktok-live-connector').WebcastPushConnection || require('tiktok-live-connector').default;
  tiktokAvailable = true;
} catch (e) {
  // not installed, that's fine for now
  tiktokAvailable = false;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || '';
const DEFAULT_DURATION = Number(process.env.AUCTION_DURATION || 60); // seconds
const EXTEND_ON_DONATION = Number(process.env.TIME_EXTENSION_ON_DONATION || 10); // seconds to add on donation

app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));

// Auction state
let timer = { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false };
let interval = null;
// participants: { username: totalCoins }
let participants = {};
// currentVS keeps last two contributors (usernames)
let currentVS = [];
// recent donations list for overlay
let recentDonations = []; // {username, coins, ts, color}

function broadcastState() {
  io.emit('state', {
    timer,
    participants,
    currentVS,
    recentDonations
  });
}

// Helper: add donation (from admin simulation or TikTok handler)
function addDonation(username, coins) {
  if (!username) username = 'Anon_' + Math.random().toString(36).slice(2,6);
  coins = Number(coins) || 0;
  participants[username] = (participants[username] || 0) + coins;

  // manage currentVS
  if (currentVS.length < 2) {
    if (!currentVS.includes(username)) currentVS.push(username);
    else { /* keep as is */ }
  } else {
    // slide to keep last two donors
    if (currentVS[1] !== username) currentVS = [currentVS[1], username];
  }

  // push recent donation (limit 20)
  const colors = ["#ff4d4d","#4d94ff","#33cc33","#ffcc00","#ff66ff","#00e6e6","#ff8c00"];
  const color = colors[Math.floor(Math.random()*colors.length)];
  recentDonations.unshift({ username, coins, ts: Date.now(), color });
  if (recentDonations.length > 20) recentDonations.pop();

  // optionally extend time
  if (EXTEND_ON_DONATION > 0 && timer.running) {
    timer.remaining = Math.min(timer.duration, timer.remaining + EXTEND_ON_DONATION);
  }

  broadcastState();
  io.emit('donationLive', { username, coins, color });
}

// Timer control
function startTimer() {
  if (timer.running) return;
  timer.running = true;
  interval = setInterval(() => {
    if (timer.remaining > 0) {
      timer.remaining--;
      broadcastState();
    } else {
      clearInterval(interval);
      timer.running = false;
      // determine winner (highest coins)
      let winner = null;
      let maxCoins = 0;
      for (const [u, total] of Object.entries(participants)) {
        if (total > maxCoins) { maxCoins = total; winner = u; }
      }
      io.emit('auctionEnd', { winner, coins: maxCoins });
    }
  }, 1000);
}

function pauseTimer() {
  if (interval) clearInterval(interval);
  timer.running = false;
  broadcastState();
}

function resetTimer(keepParticipants=false) {
  if (interval) clearInterval(interval);
  timer.remaining = timer.duration;
  timer.running = false;
  if (!keepParticipants) {
    participants = {};
    currentVS = [];
    recentDonations = [];
  }
  broadcastState();
}

// Socket connections
io.on('connection', (socket) => {
  // send current state
  socket.emit('state', { timer, participants, currentVS, recentDonations });

  socket.on('admin:start', (duration) => {
    if (duration) { timer.duration = Number(duration); timer.remaining = Number(duration); }
    startTimer();
  });

  socket.on('admin:pause', () => pauseTimer());
  socket.on('admin:resetTimer', () => resetTimer(true));
  socket.on('admin:resetAll', () => resetTimer(false));
  socket.on('admin:end', () => {
    // finalize
    if (interval) clearInterval(interval);
    timer.remaining = 0;
    timer.running = false;
    let winner = null; let maxCoins = 0;
    for (const [u, total] of Object.entries(participants)) {
      if (total > maxCoins) { maxCoins = total; winner = u; }
    }
    io.emit('auctionEnd', { winner, coins: maxCoins });
  });

  socket.on('admin:donation', ({ username, coins }) => {
    addDonation(username, coins);
  });

  // allow clients to request state
  socket.on('reqState', () => socket.emit('state', { timer, participants, currentVS, recentDonations }));
});

// Optional: connect to TikTok if available and TIKTOK_USERNAME set
if (tiktokAvailable && TIKTOK_USERNAME) {
  try {
    const conn = new WebcastPushConnection(TIKTOK_USERNAME);
    conn.connect().then(()=> console.log('Connected to TikTok live for', TIKTOK_USERNAME)).catch(e=>console.warn('TikTok connect failed', e));
    conn.on('gift', data => {
      try {
        // different versions have different payloads; try common fields
        const username = data.uniqueId || (data.user && data.user.uniqueId) || data.senderUsername || 'tiktok_user';
        const coins = data.diamondCount || data.repeatCount || data.giftValue || 0;
        addDonation(username, coins);
      } catch(e) { console.error('gift handler err', e); }
    });
  } catch(e) { console.warn('TikTok integration disabled', e); }
} else {
  if (TIKTOK_USERNAME) console.log('TikTok connector not installed or unavailable; donations simulation only.');
}

server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
