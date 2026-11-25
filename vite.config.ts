import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro lo hace la app (src/datos/actualizacion.ts), para buscar versiones nuevas al volver a la pantalla
      injectRegister: false,
      manifest: {
        name: 'Puente',
        short_name: 'Puente',
        description: 'La app del grupo de The Bridge 2027.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#1E242C',
        theme_color: '#1E242C',
        icons: [
          { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/iconos/icono-mascara-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Las letras y los íconos también quedan guardados, para abrir sin señal.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Acerca y Privacidad son páginas fijas fuera de la app (public/): no se guardan con ella y siempre se piden
        // al servidor, que las entrega tal cual (vercel.json). Tampoco el archivo con que Google verifica el sitio.
        globIgnores: ['acerca.html', 'privacidad.html', 'paginas.css', 'letras/**', 'google*.html'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/(acerca|privacidad)$/],
        // Los avisos push viven en public/avisos-sw.js
        importScripts: ['/avisos-sw.js'],
        // La primera vez, el service worker toma el control al instalarse. Una versión nueva, en cambio, espera a que
        // la app se lo pida en un momento tranquilo y recarga enseguida (src/datos/actualizacion.ts)
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
})
