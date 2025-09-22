const socket = io();

// Elementos principales
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const simulateBtn = document.getElementById('simulateBtn');

const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const themeSelect = document.getElementById('theme');

// Campos para simular donación
const simNameInput = document.getElementById('simName');
const simCoinsInput = document.getElementById('simCoins');

// Campos para texto informativo
const snipeTextInput = document.getElementById('snipeText');
const minTextInput = document.getElementById('minText');
const updateInfoBtn = document.getElementById('updateInfoBtn');

// === Eventos principales ===

// Iniciar subasta
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;

  socket.emit('admin:start', { duration, delay });
  alert(`Subasta iniciada por ${duration} segundos + ${delay} de delay.`);
});

// Detener subasta
stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
  alert('Subasta detenida manualmente.');
});

// Simular donación
simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value.trim();
  const coins = parseInt(simCoinsInput.value);

  if (!username || isNaN(coins) || coins <= 0) {
    alert('Ingresa un nombre válido y una cantidad de monedas.');
    return;
  }

  socket.emit('admin:simulate', { username, coins });
  alert(`Donación simulada: ${username} → ${coins} monedas`);
});

// Actualizar texto informativo
updateInfoBtn.addEventListener('click', () => {
  const info = {
    snipe: snipeTextInput.value || '',
    min: minTextInput.value || ''
  };

  socket.emit('admin:updateInfo', info);
  alert('Texto informativo actualizado ✅');
});

// Cambiar tema
themeSelect.addEventListener('change', () => {
  const theme = themeSelect.value;
  socket.emit('admin:theme', theme);
  alert(`Tema cambiado a: ${theme}`);
});

// === Eventos desde el servidor ===
socket.on('connect', () => console.log('Panel conectado ✅'));
socket.on('disconnect', () => console.log('Panel desconectado ❌'));
