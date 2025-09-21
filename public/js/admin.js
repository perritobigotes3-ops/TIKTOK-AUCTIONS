const socket = io(); // Conectar con el servidor

// ===== Diagnóstico de conexión =====
socket.on('connect', () => console.log('Admin conectado ✅'));
socket.on('disconnect', () => console.log('Admin desconectado ❌'));

// ===== Elementos del panel =====
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

// ===== Botones principales =====

// Iniciar subasta
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;

  socket.emit('admin:start', { duration, delay });
  alert(`🚀 Subasta iniciada por ${duration}s + ${delay}s de delay.`);
});

// Detener subasta
stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
  alert('🛑 Subasta detenida manualmente.');
});

// Reiniciar subasta
resetBtn.addEventListener('click', () => {
  socket.emit('admin:reset');
  alert('🔄 Subasta reiniciada y ranking limpio.');
  historyEl.innerHTML = ''; // Limpia historial visual
});

// ===== Simulación de donación =====
simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value.trim();
  const coins = parseInt(simCoinsInput.value) || 10;

  if (!username) {
    alert('Debes ingresar un nombre de usuario para simular.');
    return;
  }

  socket.emit('admin:simulate', { username, coins });
  alert(`💸 Simulación enviada: ${username} donó ${coins} monedas.`);
});

// ===== Cambiar tema del overlay =====
themeSelect.addEventListener('change', () => {
  const theme = themeSelect.value;
  socket.emit('admin:theme', theme);
  alert(`🎨 Tema cambiado a: ${theme}`);
});

// ===== Historial de subastas =====
socket.on('auctionEnd', (state) => {
  const sorted = Object.entries(state.participants || {}).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return;

  const [winner, coins] = sorted[0];
  const time = new Date().toLocaleTimeString();

  const div = document.createElement('div');
  div.className = 'history-item';
  div.textContent = `${time} - Ganador: ${winner} (${coins} 💰)`;

  historyEl.prepend(div);
});
