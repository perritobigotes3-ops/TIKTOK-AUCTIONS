// overlay.js
const socket = io();

// Elementos del DOM
const timerEl = document.getElementById("auction-timer");
const rankingEl = document.getElementById("ranking");
const vsLeftEl = document.getElementById("vs-left");
const vsRightEl = document.getElementById("vs-right");
const vsLeftCoinsEl = document.getElementById("vs-left-coins");
const vsRightCoinsEl = document.getElementById("vs-right-coins");

const winnerScreen = document.getElementById("winnerScreen");
const winnerAvatarImg = document.getElementById("winnerAvatarImg");
const winnerDefaultEmoji = document.getElementById("winnerDefaultEmoji");
const winnerCoinsEl = document.getElementById("winnerCoins");

// ============================
// Actualizar contador
// ============================
function updateTimer(state) {
  let remaining = state.timer.inDelay ? state.timer.delayRemaining : state.timer.remaining;

  if (remaining === null || remaining < 0) remaining = 0;

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  timerEl.textContent = `${minutes}:${seconds}`;

  // Parpadeo cuando quedan menos de 10 segundos
  if (remaining <= 10) {
    timerEl.classList.add("blink");
  } else {
    timerEl.classList.remove("blink");
  }
}

// ============================
// Actualizar Ranking
// ============================
function updateRanking(state) {
  const sorted = Object.entries(state.participants)
    .sort((a, b) => b[1] - a[1]) // Orden descendente
    .slice(0, 10); // Solo top 10

  rankingEl.innerHTML = `
    <div class="ranking-title">🏆 Ranking</div>
    ${sorted
      .map(([username, coins], index) => {
        const donation = state.recentDonations.find(d => d.username === username);
        const avatar = donation && donation.avatar ? donation.avatar : null;

        return `
          <div class="participant">
            <div class="left">
              <div class="avatar">
                ${
                  avatar
                    ? `<img src="${avatar}" alt="${username}">`
                    : `<div class="emoji-flame">🔥</div>`
                }
              </div>
              <div class="name">${username}</div>
            </div>
            <div class="coins">${coins} 💰</div>
          </div>
        `;
      })
      .join("")}
  `;
}

// ============================
// Actualizar VS dinámico
// ============================
function updateVS(state) {
  const sorted = Object.entries(state.participants).sort((a, b) => b[1] - a[1]);
  const left = sorted[0] || ["—", 0];
  const right = sorted[1] || ["—", 0];

  vsLeftEl.textContent = left[0];
  vsLeftCoinsEl.textContent = `${left[1]} 💰`;

  vsRightEl.textContent = right[0];
  vsRightCoinsEl.textContent = `${right[1]} 💰`;
}

// ============================
// Mostrar Pantalla de Ganador
// ============================
function showWinner(winner) {
  if (!winner) return;

  // Buscar avatar del ganador
  const winnerDonation = winner.username
    ? lastState.recentDonations.find(d => d.username === winner.username)
    : null;

  if (winnerDonation && winnerDonation.avatar) {
    winnerAvatarImg.src = winnerDonation.avatar;
    winnerAvatarImg.style.display = "block";
    winnerDefaultEmoji.style.display = "none";
  } else {
    winnerAvatarImg.style.display = "none";
    winnerDefaultEmoji.style.display = "flex";
  }

  winnerCoinsEl.textContent = `${winner.username} - ${winner.coins} 💰`;

  winnerScreen.style.display = "flex";

  // Ocultar después de 5 segundos
  setTimeout(() => {
    winnerScreen.style.display = "none";
  }, 5000);
}

// ============================
// Manejo de estado global
// ============================
let lastState = null;

socket.on("state", (state) => {
  lastState = state;
  updateTimer(state);
  updateRanking(state);
  updateVS(state);
});

socket.on("auctionEnd", (data) => {
  showWinner(data.winner);
});

// ============================
// Mensajes de depuración
// ============================
socket.on("connect", () => {
  console.log("✅ Conectado al servidor de overlay");
});

socket.on("disconnect", () => {
  console.log("❌ Desconectado del servidor");
});
