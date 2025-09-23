const socket = io();

// Elementos
const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const infoDelayInput = document.getElementById('infoDelay');
const infoMinimoInput = document.getElementById('infoMinimo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const simulateBtn = document.getElementById('simulateBtn');
const simNameInput = document.getElementById('simName');
const simCoinsInput = document.getElementById('simCoins');
const historyEl = document.getElementById('history');

// Iniciar subasta
startBtn.addEventListener('click', () => {
  socket.emit('admin:start', {
    duration: parseInt(durationInput.value) || 60,
    delay: parseInt(delayInput.value) || 10
  });
});

// Detener
stopBtn.addEventListener('click', () => socket.emit('admin:stop'));

// Reiniciar
resetBtn.addEventListener('click', () => socket.emit('admin:reset'));

// Simular donación
simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value || 'Invitado';
  const coins = parseInt(simCoinsInput.value) || 1;
  socket.emit('admin:simulate', { username, coins });
});

// Enviar información del overlay
function sendInfo() {
  socket.emit('admin:updateInfo', {
    delayText: infoDelayInput.value,
    minimoText: infoMinimoInput.value
  });
}
infoDelayInput.addEventListener('input', sendInfo);
infoMinimoInput.addEventListener('input', sendInfo);

// Historial
socket.on('history', (h) => {
  historyEl.innerHTML = '';
  if (!h || !h.length) {
    historyEl.innerHTML = '<div style="color:#777">No hay historial</div>';
    return;
  }
  h.forEach(it => {
    const winner = it.winner ? `${it.winner.username} (${it.winner.coins}💰)` : '—';
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<strong>${(new Date(it.ts)).toLocaleString()}</strong> <br> Ganador: ${winner}`;
    historyEl.appendChild(div);
  });
});

socket.on('connect', () => console.log('Admin conectado ✅'));
socket.on('disconnect', () => console.log('Admin desconectado ❌'));
