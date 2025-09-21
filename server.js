const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos desde la raíz
app.use(express.static(__dirname));

// Ruta principal → admin
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Ruta overlay
app.get('/overlay', (req, res) => {
  res.sendFile(path.join(__dirname, 'overlay.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});