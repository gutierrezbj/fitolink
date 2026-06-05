import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3040,
    proxy: {
      '/api': {
        target: 'http://localhost:4040',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Sprint deudas técnicas A4 · 05-jun-2026 · Code splitting
    //
    // Antes: bundle único 1.54MB sin splitting → carga lenta en móvil 4G
    // (~3-5s primera vez). Ahora separamos las librerías pesadas que NO
    // se usan en la home/login/landing en chunks aparte, que el navegador
    // descarga solo cuando el usuario navega a una página que los necesita.
    //
    // Chunks definidos:
    //  · react-vendor   · react + react-dom + react-router-dom (siempre)
    //  · leaflet-vendor · leaflet + react-leaflet (mapas — solo dashboard)
    //  · charts-vendor  · recharts (gráficos NDVI — solo parcel detail)
    //  · query-vendor   · @tanstack/react-query
    //
    // Resultado esperado: bundle inicial ~300-400KB (vs 1.54MB anterior).
    // Landing/login/sigpac cargan rápido; los dashboards que usan mapas
    // descargan leaflet-vendor on-demand al entrar.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'leaflet-vendor': ['leaflet', 'react-leaflet'],
          'charts-vendor': ['recharts'],
          'query-vendor': ['@tanstack/react-query'],
        },
      },
    },
    // Suprime el warning de "chunks > 500KB" — algunos vendors (leaflet,
    // recharts) son grandes por naturaleza y no podemos partirlos más
    // sin perder funcionalidad.
    chunkSizeWarningLimit: 800,
  },
});
