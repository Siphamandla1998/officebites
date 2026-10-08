import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "OfficeBites — Office Food Marketplace",
        short_name: "OfficeBites",
        description:
          "Order lunch from local office vendors, track your ticket, and manage your store — all in one PWA.",
        theme_color: "#17140F",
        background_color: "#FBF9F5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Offline support is the public app shell/assets only. Supabase data,
        // Auth, signed URLs and private attachments always require the network.
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.destination === "image" && url.origin === self.location.origin && !url.search && /^\/(assets\/|icons\/|placeholder-food\.svg$|favicon\.svg$)/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "officebites-public-image-v2",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 }, // 14 days
            },
          },
        ],
        navigateFallback: "/index.html",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
