<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Overlay Subasta Pro</title>
  <link rel="stylesheet" href="/css/style-gamer.css" id="theme-style">

  <style>
    /* ===== Reset ===== */
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', sans-serif;
      background: #000; /* Fondo negro */
      overflow: hidden;
      color: #fff;
    }

    #overlay-container {
      position: relative;
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding-top: 10px;
      box-sizing: border-box;
    }

    /* ===== Barra de información ===== */
    #info-bar {
      text-align: center;
      margin-bottom: 15px;
      padding: 8px 20px;
      border-radius: 10px;
      background: rgba(255, 0, 0, 0.3);
      box-shadow: 0 0 15px rgba(255, 0, 0, 0.8);
    }
    #info-bar div {
      font-size: 20px;
      font-weight: bold;
    }

    /* ===== Contador ===== */
    #auction-timer-container {
      margin: 10px 0;
      padding: 15px 40px;
      border-radius: 12px;
      background: rgba(0,0,0,0.6);
      box-shadow: 0 0 20px rgba(0,225,255,0.8);
    }
    #auction-timer {
      font-size: 70px;
      font-weight: 900;
      text-shadow: 0 0 20px #00e1ff, 0 0 40px #00bcd4;
    }
    #auction-timer.blink {
      animation: blink 0.8s infinite;
    }
    @keyframes blink {
      from { opacity: 1; }
      to { opacity: 0.3; }
    }

    /* ===== Ranking ===== */
    #ranking {
      width: 90%;
      max-width: 600px;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(6px);
      border-radius: 12px;
      padding: 15px;
      margin-top: 10px;
      box-shadow: 0 0 20px rgba(0,225,255,0.8);
    }
    .ranking-title {
      text-align: center;
      font-size: 24px;
      margin-bottom: 15px;
      color: #fff;
      text-shadow: 0 0 10px #00e1ff;
    }
    .participant {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
      transition: transform 0.3s;
    }
    .participant .left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid #fff;
      box-shadow: 0 0 10px rgba(255,255,255,0.8);
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .name {
      font-size: 18px;
      font-weight: bold;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .coins {
      font-size: 18px;
      font-weight: bold;
      color: gold;
    }
    .medal {
      font-size: 24px;
    }

    /* ===== VS ===== */
    #vs-container {
      width: 90%;
      max-width: 700px;
      text-align: center;
      margin: 15px 0;
    }
    .vs-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 15px;
      border-radius: 16px;
      background: rgba(0,0,0,0.7);
      box-shadow: 0 0 30px rgba(255,87,34,0.7);
    }
    .vs-side {
      flex: 1;
      text-align: center;
    }
    .vs-name {
      font-size: 26px;
      font-weight: 900;
      color: #fff;
    }
    .vs-coins {
      font-size: 20px;
      color: #ffd66b;
      margin-top: 5px;
    }
    .flame {
      font-size: 36px;
      animation: flame 1s infinite alternate;
      color: orangered;
      text-shadow: 0 0 20px #ff6600;
    }
    @keyframes flame {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(1.2); opacity: 0.7; }
    }

    /* ===== Pantalla ganador ===== */
    #winnerScreen {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      background: rgba(0,0,0,0.9);
      z-index: 9999;
    }
    #winnerTitle {
      font-size: 46px;
      font-weight: 900;
      text-shadow: 0 0 15px #fff, 0 0 40px #ff0, 0 0 60px #f90;
      margin-bottom: 20px;
    }
    #winnerAvatar {
      width: 220px;
      height: 220px;
      border-radius: 50%;
      margin: 20px auto;
      border: 8px solid gold;
      box-shadow: 0 0 50px rgba(255,215,0,0.9);
      overflow: hidden;
    }
    #winnerCoins {
      font-size: 30px;
      color: gold;
      animation: sparkle 1.5s infinite;
    }
    @keyframes sparkle {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div id="overlay-container">

    <!-- Barra de información -->
    <div id="info-bar">
      <div id="info-delay">⚡ Delay 10 Segundos</div>
      <div id="info-minimo">💰 Sin mínimo</div>
    </div>

    <!-- Contador -->
    <div id="auction-timer-container">
      <div id="auction-timer">00:00</div>
    </div>

    <!-- Ranking -->
    <div id="ranking">
      <div class="ranking-title">🏆 Top Donadores</div>
    </div>

    <!-- VS dinámico -->
    <div id="vs-container">
      <div class="vs-box">
        <div class="vs-side">
          <div id="vs-left" class="vs-name">—</div>
          <div id="vs-left-coins" class="vs-coins">0 💰</div>
        </div>
        <div class="flame">🔥 VS 🔥</div>
        <div class="vs-side">
          <div id="vs-right" class="vs-name">—</div>
          <div id="vs-right-coins" class="vs-coins">0 💰</div>
        </div>
      </div>
    </div>

    <!-- Pantalla del ganador -->
    <div id="winnerScreen">
      <div id="winnerTitle">🎉 ¡Felicidades!</div>
      <div id="winnerAvatar">
        <img src="/assets/avatar-placeholder.png" style="width:100%;height:100%;object-fit:cover">
      </div>
      <div id="winnerCoins">Donó 0 💰</div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/overlay.js"></script>
</body>
</html>
