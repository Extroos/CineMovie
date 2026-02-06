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
          '/api': {
             target: 'http://localhost:3001',
             changeOrigin: true,
             rewrite: (path) => path.replace(/^\/api/, ''),
          },
          '/vidsrc': {
            target: 'https://vidsrc.icu',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/vidsrc/, ''),
          },
          '/consumet': {
             target: 'https://api.consumet.org',
             changeOrigin: true,
             rewrite: (path) => path.replace(/^\/consumet/, ''),
          },
          '/hianime': {
             target: 'http://localhost:3001',
             changeOrigin: true,
             rewrite: (path) => path.replace(/^\/hianime/, ''),
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
          '@/lib': path.resolve(__dirname, 'kitsune-lib'),
          '@/components': path.resolve(__dirname, 'kitsune-components'),
          '@/hooks': path.resolve(__dirname, 'kitsune-hooks'),
          '@/query': path.resolve(__dirname, 'kitsune-query'),
          '@/mutation': path.resolve(__dirname, 'kitsune-mutation'),
          '@/providers': path.resolve(__dirname, 'kitsune-providers'),
          '@/services': path.resolve(__dirname, 'kitsune-services'),
          '@/contexts': path.resolve(__dirname, 'kitsune-contexts'),
          '@/assets': path.resolve(__dirname, 'kitsune-assets'),
          '@/configs': path.resolve(__dirname, 'kitsune-configs'),
          '@/types': path.resolve(__dirname, 'kitsune-types'),
          '@/utils': path.resolve(__dirname, 'kitsune-utils'),
          '@/store': path.resolve(__dirname, 'kitsune-store'),
          '@/constants': path.resolve(__dirname, 'kitsune-constants'),
          '@/icons': path.resolve(__dirname, 'kitsune-icons'),
          '@': path.resolve(__dirname, '.'),
          'next/link': path.resolve(__dirname, 'kitsune-lib/shims/link.tsx'),
          'next/image': path.resolve(__dirname, 'kitsune-lib/shims/image.tsx'),
          'next-themes': path.resolve(__dirname, 'node_modules/next-themes'),
          'next-runtime-env': path.resolve(__dirname, 'kitsune-lib/shims/env.ts'),
          'next/font/local': path.resolve(__dirname, 'kitsune-lib/shims/font/local.tsx'),
        }
      }
    };
});
