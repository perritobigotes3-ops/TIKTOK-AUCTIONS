// server.js - Subastas estilo 14alls mejorado
require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const DEFAULT_DURATION = Number(process.env.AUCTION_DURATION || 60); // seconds
const DEFAULT_DELAY = Number(process.env.AUCTION_DELAY || 10); // seconds

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'public', 'overlay.html')));

// State
let timer = { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false, inDelay: false, delayRemaining: DEFAULT_DELAY };
let interval = null;
let participants = {}; // username -> coins
let recentDonations = []; // {username, coins, color, avatar}
let avatarCache = {}; // username -> url

const COLOR_POOL = ["#ff4d4d","#4d94ff","#33cc33","#ffcc00","#ff66ff","#00e6e6","#ff8c00","#9b59b6"];

function broadcastState() {
  io.emit('state', { timer, participants, recentDonations });
}

async function fetchTikTokAvatar(username) {
  if(!username) return '/assets/avatar-placeholder.png';
  if(avatarCache[username]) return avatarCache[username];
  try {
    // Try to fetch the user page and extract og:image (works in many setups)
    const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } , redirect: 'follow' , timeout: 8000 });
    const text = await res.text();
    const m = text.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if(m && m[1]) {
      avatarCache[username] = m[1];
      return m[1];
    }
  } catch(e){
    console.warn('avatar fetch failed for', username, e && e.message);
  }
  // fallback to placeholder
  return '/assets/avatar-placeholder.png';
}

async function addDonation(username, coins) {
  coins = Number(coins) || 0;
  if(!username) username = 'Anon_' + Math.random().toString(36).slice(2,6);
  participants[username] = (participants[username] || 0) + coins;
  const color = COLOR_POOL[Math.floor(Math.random()*COLOR_POOL.length)];
  const avatar = await fetchTikTokAvatar(username);
  recentDonations.unshift({ username, coins, color, avatar, ts: Date.now() });
  if(recentDonations.length > 12) recentDonations.pop();
  broadcastState();
  io.emit('donationLive', { username, coins, color, avatar });
}

function startTimer() {
  if(timer.running) return;
  timer.running = true;
  timer.inDelay = false;
  timer.remaining = timer.duration;
  timer.delayRemaining = timer.delayRemaining || DEFAULT_DELAY;
  interval = setInterval(() => {
    if(!timer.inDelay) {
      if(timer.remaining > 0) {
        timer.remaining--;
        broadcastState();
        if(timer.remaining === 0) {
          // enter delay
          timer.inDelay = true;
          timer.delayRemaining = timer.delay || DEFAULT_DELAY;
          io.emit('enterDelay', { delay: timer.delayRemaining });
        }
      }
    } else {
      if(timer.delayRemaining > 0) {
        timer.delayRemaining--;
        broadcastState();
        if(timer.delayRemaining === 0) {
          // finalize - pick winner by coins
          clearInterval(interval);
          timer.running = false;
          timer.inDelay = false;
          const entries = Object.entries(participants);
          let winner = null, max = 0;
          for(const [u, total] of entries) {
            if(total > max) { max = total; winner = u; }
          }
          io.emit('auctionEnd', { winner, coins: max || 0 });
        }
      }
    }
  }, 1000);
}

function pauseTimer() {
  if(interval) clearInterval(interval);
  timer.running = false;
  broadcastState();
}

function resetAll() {
  if(interval) clearInterval(interval);
  timer = { duration: DEFAULT_DURATION, remaining: DEFAULT_DURATION, running: false, inDelay: false, delayRemaining: DEFAULT_DELAY, delay: DEFAULT_DELAY };
  participants = {};
  recentDonations = [];
  broadcastState();
}

io.on('connection', (socket) => {
  socket.emit('state', { timer, participants, recentDonations });
  socket.on('admin:start', ({ duration, delay }) => {
    if(duration) { timer.duration = Number(duration); timer.remaining = Number(duration); }
    if(typeof delay !== 'undefined') { timer.delay = Number(delay); timer.delayRemaining = Number(delay); }
    startTimer();
  });
  socket.on('admin:pause', () => pauseTimer());
  socket.on('admin:resetAll', () => resetAll());
  socket.on('admin:donation', async (d) => { await addDonation(d.username, d.coins); });
  socket.on('reqState', () => socket.emit('state', { timer, participants, recentDonations }));
});

// small placeholder avatar file creation (so deploy has one)
const fs = require('fs');
const ph = path.join(__dirname, 'public', 'assets', 'avatar-placeholder.png');
if(!fs.existsSync(ph)) {
  // write a 1x1 png placeholder (transparent)
  const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAlMB9y1Dq0sAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(ph, data);
}

server.listen(PORT, () => console.log(`Server listening on ${PORT}`));
