// --- overlay.js ---
// Conexión con socket.io
const socket = io();
const rankingContainer = document.getElementById('ranking');
const themeStyle = document.getElementById('theme-style');

// Actualizar ranking
socket.on('state', (state) => {
  renderRanking(state.participants);
});

// Cambiar tema dinámicamente
socket.on('themeChange', (theme) => {
  if (theme === 'gamer') {
    themeStyle.href = '/css/style-gamer.css';
  } else if (theme === 'femenino') {
    themeStyle.href = '/css/style-femenino.css';
  }
});

// Renderizar Top 3
function renderRanking(participants) {
  const sorted = Object.entries(participants)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  rankingContainer.innerHTML = '';

  const medals = ['🥇', '🥈', '🥉'];

  sorted.forEach(([username, coins], index) => {
    const participant = document.createElement('div');
    participant.classList.add('participant');
    participant.innerHTML = `
      <div class="avatar">
        <img src="/assets/avatar-placeholder.png" alt="${username}">
      </div>
      <div class="name">${username}</div>
      <div class="medal">${medals[index]}</div>
    `;
    rankingContainer.appendChild(participant);
  });
}// JS para overlay
