Proyecto: Subastas estilo 14alls - versión final (gamer y femenino)

Estructura:

- server.js
- package.json
- public/admin.html
- public/overlay.html
- public/css/style-gamer.css
- public/css/style-femenino.css
- public/assets/ (placeholders)

Deploy:
1. Subir los archivos al repo
2. Render: Build Command -> npm install
   Start Command -> node server.js
3. (Opcional) Environment variables: AUCTION_DURATION, AUCTION_DELAY, TIKTOK_USERNAME

Notas:
- El servidor intenta obtener avatars público de TikTok por https://www.tiktok.com/@username usando og:image.
- Reemplaza los assets por GIFs y sonidos en public/assets para mejorar visual.
