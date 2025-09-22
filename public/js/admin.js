const socket = io();

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const simulateBtn = document.getElementById('simulateBtn');

startBtn.addEventListener('click', () => {
  const duration = parseInt(document.getElementById('duration').value) || 60;
  const delay = parseInt(document.getElementById('delay').value) || 10;
  socket.emit('admin:start', { duration, delay });
  alert(`Subasta iniciada: ${duration}s + ${delay}s de delay`);
});

stopBtn.addEventListener('click', () => {
  socket.emit('admin:stop');
  alert('Subasta detenida manualmente');
});

resetBtn.addEventListener('click', () => {
  socket.emit('admin:reset');
  alert('Subasta reiniciada');
});

simulateBtn.addEventListener('click', () => {
  const username = document.getElementById('simName').value || "Invitado";
  const coins = parseInt(document.getElementById('simCoins').value) || 10;
  socket.emit('admin:simulate', { username, coins });
});

document.getElementById('theme').addEventListener('change', (e) => {
  socket.emit('admin:theme', e.target.value);
});
