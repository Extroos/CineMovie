import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/vidsrc': {
            target: 'https://v2.vidsrc.me',
            changeOrigin: true,
            followRedirects: true,
            rewrite: (path) => path.replace(/^\/vidsrc/, ''),
          },
          '/vidsrc-cc': {
            target: 'https://vidsrc.cc',
            changeOrigin: true,
            followRedirects: true,
            rewrite: (path) => path.replace(/^\/vidsrc-cc/, ''),
          },
          '/consumet': {
             target: 'https://api.consumet.org',
             changeOrigin: true,
             rewrite: (path) => path.replace(/^\/consumet/, ''),
          },
          '/proxy': {
            target: 'https://cinemovie-proxy.abderrahmanchakkouri.workers.dev', 
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
          'next-themes': path.resolve(__dirname, 'node_modules/next-themes'),
        }
      }
    };
});
