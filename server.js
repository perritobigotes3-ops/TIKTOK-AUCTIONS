const express = require('express');
const path = require('path');
const http = require('http');
const { WebcastPushConnection } = require('tiktok-live-connector');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const port = process.env.PORT || 3000;
const tiktokUsername = process.env.TIKTOK_USERNAME || "mykestradesbrainrots";

let auction = {
  active: false,
  remaining: 0,
  interval: null,
  winners: [],
  leaderboard: {}
};

// Static files
app.use(express.static(__dirname));
// WebSocket
io.on('connection', (socket) => {
  console.log('Cliente conectado');
  socket.emit('auctionUpdate', auction);

  socket.on('startAuction', (minutes) => {
    if (!auction.active) {
      auction.active = true;
      auction.remaining = minutes * 60;
      auction.leaderboard = {};
      startTimer();
      io.emit('auctionUpdate', auction);
    }
  });

  socket.on('pauseAuction', () => {
    clearInterval(auction.interval);
    auction.interval = null;
    io.emit('auctionUpdate', auction);
  });

  socket.on('resumeAuction', () => {
    if (auction.active && !auction.interval) {
      startTimer();
    }
  });

  socket.on('resetAuction', () => {
    auction = { active: false, remaining: 0, interval: null, winners: [], leaderboard: {} };
    io.emit('auctionUpdate', auction);
  });

  socket.on('endAuction', () => {
    endAuction();
  });
});

function startTimer() {
  auction.interval = setInterval(() => {
    if (auction.remaining > 0) {
      auction.remaining--;
      io.emit('auctionUpdate', auction);
    } else {
      endAuction();
    }
  }, 1000);
}

function endAuction() {
  clearInterval(auction.interval);
  auction.active = false;
  auction.interval = null;
  io.emit('auctionEnded', auction.leaderboard);
}

// TikTok Live Connector
let tiktokConnection = new WebcastPushConnection(tiktokUsername);
tiktokConnection.connect().then(state => {
  console.log(`Conectado a sala de @${tiktokUsername}`);
}).catch(err => {
  console.error("No se pudo conectar:", err);
});

tiktokConnection.on('gift', data => {
  if (auction.active) {
    const user = data.uniqueId;
    const points = data.gift.diamond_count * (data.repeatEnd ? data.repeatCount : 1);
    if (!auction.leaderboard[user]) auction.leaderboard[user] = 0;
    auction.leaderboard[user] += points;
    io.emit('auctionUpdate', auction);
  }
});

server.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});
