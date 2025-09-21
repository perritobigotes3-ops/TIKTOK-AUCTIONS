const socket = io();

// ===== Elementos HTML =====
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const simulateBtn = document.getElementById('simulateBtn');
const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const themeSelect = document.getElementById('theme');
const simNameInput = document.getElementById('simName');
const simCoinsInput = document.getElementById('simCoins');
const historyEl = document.getElementById('history');

// ===== Eventos =====
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;
  socket.emit('admin:start', { duration, delay });
  alert(`Subasta iniciada por ${duration}s + ${delay}s de delay.`);
});

stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
  alert('Subasta detenida manualmente.');
});

resetBtn.addEventListener('click', () => {
  socket.emit('admin:reset');
  alert('Subasta reiniciada.');
});

simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value.trim() || 'Invitado';
  const coins = parseInt(simCoinsInput.value) || 10;
  socket.emit('admin:simulate', { username, coins });
  alert(`Simulación: ${username} donó ${coins} monedas.`);
});

themeSelect.addEventListener('change', () => {
  const theme = themeSelect.value;
  socket.emit('admin:theme', theme);
  alert(`Tema cambiado a: ${theme}`);
});

// ===== Historial =====
function renderHistory(history) {
  historyEl.innerHTML = '';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const top3 = item.top3.map(t => `${t[0]} (${t[1]}💰)`).join(', ');
    div.innerHTML = `
      <strong>${item.date}</strong><br>
      🏆 Ganador: ${item.winner} — ${item.coins} 💰<br>
      Top 3: ${top3}
    `;
    historyEl.appendChild(div);
  });
}

socket.on('history', (history) => {
  renderHistory(history);
});

socket.on('connect', () => {
  console.log('Admin conectado ✅');
  socket.emit('admin:getHistory');
});

socket.on('disconnect', () => {
  console.log('Admin desconectado ❌');
});
