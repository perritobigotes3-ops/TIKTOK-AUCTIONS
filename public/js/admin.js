const socket = io();

// Botones
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const simulateBtn = document.getElementById('simulateBtn');

// Inputs
const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const themeSelect = document.getElementById('theme');
const infoDelayInput = document.getElementById('infoDelay');
const infoMinimoInput = document.getElementById('infoMinimo');

// Iniciar subasta
startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;
  socket.emit('admin:start', { duration, delay });
});

// Detener subasta
stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
});

// Reiniciar subasta
resetBtn.addEventListener('click', () => {
  socket.emit('admin:reset');
});

// Simular donación
simulateBtn.addEventListener('click', () => {
  const username = prompt('Nombre del donador simulado:', 'Usuario');
  const coins = parseInt(prompt('Monedas donadas:', '10'));
  if (username && coins > 0) {
    socket.emit('admin:simulate', { username, coins });
  }
});

// Actualizar textos en tiempo real
function updateInfo() {
  socket.emit('admin:updateInfo', {
    delayText: infoDelayInput.value,
    minimoText: infoMinimoInput.value
  });
}
infoDelayInput.addEventListener('input', updateInfo);
infoMinimoInput.addEventListener('input', updateInfo);
