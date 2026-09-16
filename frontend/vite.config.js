import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const backendPort = process.env.VITE_BACKEND_PORT || '5002';
const backendHost = process.env.VITE_BACKEND_HOST || '127.0.0.1';
const apiTarget = `http://${backendHost}:${backendPort}`;

const proxyErrorHandler = (proxy, _options) => {
  proxy.on('error', (err, _req, res) => {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      if (res && !res.headersSent && typeof res.writeHead === 'function') {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Backend server is starting...' }));
      }
      return;
    }
    console.error('[vite proxy error]:', err);
  });
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: proxyErrorHandler,
      },
      '/auth': {
        target: apiTarget,
        changeOrigin: true,
        configure: proxyErrorHandler,
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
        configure: proxyErrorHandler,
      },
    }
  }
})
