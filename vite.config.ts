import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// Enable React Compiler only in production (causes dev mode slowdown)
const isProduction = process.env.NODE_ENV === 'production'

// https://vite.dev/config/
export default defineConfig({
  // Base path for GitHub Pages project site
  base: '/BYD-CRM-v2/',
  plugins: [
    react(
      isProduction
        ? {
            babel: {
              plugins: [['babel-plugin-react-compiler', {}]],
            },
          }
        : undefined
    ),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-pdf': ['pdfjs-dist', 'jspdf'],
          'vendor-excel': ['xlsx', 'xlsx-populate'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ocr': ['tesseract.js'],
        },
      },
    },
  },
})
