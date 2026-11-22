import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assistant-icon.svg"],
      manifest: {
        name: "Asistente Familiar",
        short_name: "Asistente",
        description: "Hablá con tu asistente familiar.",
        lang: "es-AR",
        theme_color: "#111313",
        background_color: "#111313",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/assistant-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.ASSISTANT_DEV_BACKEND_URL || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
