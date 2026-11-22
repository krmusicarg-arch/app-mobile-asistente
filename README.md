# Asistente Familiar móvil

PWA React para Android/Chrome. La app usa el reconocimiento de voz
(`SpeechRecognition`, idioma `es-AR`) y la síntesis (`SpeechSynthesis`) del
navegador; al backend envía únicamente el texto reconocido.

## Desarrollo local

1. Inicia el backend siguiendo `../esp32-chat/README.md`.
2. Desde esta carpeta ejecuta `npm install` y `npm run dev`.
3. Vite envía `/api/*` al backend local en `http://localhost:8787`. Para otro
   destino local, define `ASSISTANT_DEV_BACKEND_URL` antes de iniciar Vite.
4. Abre en Chrome. Para instalarla en un teléfono de la red, usa la URL de
   desarrollo accesible desde ese teléfono; el reconocimiento de voz requiere
   un contexto seguro (HTTPS, salvo localhost).

## Compilación y despliegue

1. Copia `.env.example` a `.env.production` y configura
   `VITE_ASSISTANT_BACKEND_URL` con el origen HTTPS del backend (sin `/api`).
2. Ejecuta `npm run build`; publica el contenido de `dist/` como sitio estático
   HTTPS. Configura ese origen exacto en `ASSISTANT_MOBILE_ORIGINS` del backend.
3. En Vercel, los valores `VITE_*` se incorporan al bundle y son públicos.
   No pongas allí el código familiar, el token de dispositivo ni claves API.

La primera vez se solicita el código familiar (de al menos 24 caracteres) y se
elige el integrante. El backend firma una sesión temporal de siete días
vinculada a esa persona. El código nunca se guarda en el navegador; al vencer la
sesión se vuelve a pedir.

La Web Speech API depende del navegador y de sus servicios de voz; Chrome para
Android es el objetivo inicial. El navegador puede procesar el audio mediante
un servicio propio, por lo que esta PWA no garantiza reconocimiento offline o
exclusivamente local. Si el navegador no ofrece reconocimiento, la app informa
el problema y no envía una consulta vacía.
