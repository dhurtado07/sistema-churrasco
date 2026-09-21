import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "autoUpdate": el service worker se actualiza solo en segundo plano
      // apenas hay una versión nueva — nadie en Caja/Cocina/Parrilla debe
      // acordarse de "reinstalar la app" cada vez que se despliega un cambio.
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "BRASA ARISP",
        short_name: "BRASA ARISP",
        description: "Caja, cocina, parrilla y administración de BRASA ARISP",
        lang: "es",
        // Mismo tono oscuro que ya usa el resto de la app (sidebar, botones).
        theme_color: "#171717",
        background_color: "#171717",
        display: "standalone",
        start_url: "/login",
        scope: "/",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Sin config extra de workbox: solo cachea los archivos propios de la
      // app (JS/CSS/HTML/íconos), lo que alcanza para abrir rápido y quedar
      // instalable. La API vive en otro origen (api.<dominio> en producción,
      // otro puerto en desarrollo) — este service worker, con scope acá, no
      // puede interceptar ni cachear esas respuestas aunque quisiera, así
      // que ningún dato del negocio (pedidos, precios, stock) queda
      // guardado en una caché vieja.
    }),
  ],
  server: {
    port: 5173,
  },
});
