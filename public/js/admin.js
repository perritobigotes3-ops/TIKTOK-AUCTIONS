const socket = io();

// Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const themeSelect = document.getElementById('theme');

const simNameInput = document.getElementById('simName');
const simCoinsInput = document.getElementById('simCoins');
const simulateBtn = document.getElementById('simulateBtn');

const snipeTextInput = document.getElementById('snipeText');
const minTextInput = document.getElementById('minText');
const updateInfoBtn = document.getElementById('updateInfoBtn');

// Start auction
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;
  socket.emit('admin:start', { duration, delay });
  alert(`Subasta iniciada: ${duration}s + delay ${delay}s`);
});

// Stop auction (force end)
stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
  alert('Subasta detenida (finalizada).');
});

// Reset auction (clear points & donators)
resetBtn.addEventListener('click', () => {
  if (!confirm('¿Reiniciar la subasta? Esto borrará puntos y donadores.')) return;
  socket.emit('admin:reset');
  alert('Subasta reiniciada (puntos y donadores limpiados).');
});

// Simulate donation
simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value.trim();
  const coins = parseInt(simCoinsInput.value);
  if (!username || !coins || coins <= 0) { alert('Nombre y monedas válidas.'); return; }
  socket.emit('admin:simulate', { username, coins });
  alert(`Simulación enviada: ${username} → ${coins} 💰`);
});

// Update info text
updateInfoBtn.addEventListener('click', () => {
  socket.emit('admin:updateInfo', {
    snipe: snipeTextInput.value || '',
    min: minTextInput.value || ''
  });
  alert('Texto informativo actualizado.');
});

// Theme change
themeSelect.addEventListener('change', () => {
  socket.emit('admin:theme', themeSelect.value);
  alert(`Tema cambiado a: ${themeSelect.value}`);
});

socket.on('connect', () => console.log('Admin panel conectado ✅'));
socket.on('disconnect', () => console.log('Admin panel desconectado ❌'));
