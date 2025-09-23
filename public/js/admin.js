const socket = io.connect(window.location.origin, { transports: ['websocket'] });

// elementos
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

startBtn.addEventListener('click', () => {
  const duration = parseInt(durationInput.value) || 60;
  const delay = parseInt(delayInput.value) || 10;
  socket.emit('admin:start', { duration, delay });
});

stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
});

resetBtn.addEventListener('click', () => {
  socket.emit('admin:reset');
});

simulateBtn.addEventListener('click', () => {
  const username = simNameInput.value || prompt('Nombre simulación','Invitado');
  const coins = parseInt(simCoinsInput.value) || parseInt(prompt('Monedas','10'));
  if (username && coins > 0) socket.emit('admin:simulate', { username, coins });
});

// enviar textos informativos
function sendInfo() {
  socket.emit('admin:updateInfo', {
    delayText: infoDelayInput.value,
    minimoText: infoMinimoInput.value
  });
}
infoDelayInput.addEventListener('input', sendInfo);
infoMinimoInput.addEventListener('input', sendInfo);

// historial
socket.on('history', (h) => {
  historyEl.innerHTML = '';
  if (!h || !h.length) {
    historyEl.innerHTML = '<div style="color:#777">No hay historial</div>';
    return;
  }
  h.forEach(it => {
    const winner = it.winner ? `${it.winner.username} (${it.winner.coins}💰)` : '—';
    const div = document.createElement('div');
    div.style.borderBottom = '1px solid #222';
    div.style.padding = '6px 4px';
    div.innerHTML = `<strong>${(new Date(it.ts)).toLocaleString()}</strong><div style="color:#ccc">Ganador: ${winner}</div>`;
    historyEl.appendChild(div);
  });
});

// update inicial
socket.on('updateInfo', (d) => {
  if (!d) return;
  infoDelayInput.value = d.delayText || '';
  infoMinimoInput.value = d.minimoText || '';
});
