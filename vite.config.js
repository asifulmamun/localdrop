import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import signalingPlugin from './vite-signaling-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), signalingPlugin()],
  base: './',
  server: {
    host: '0.0.0.0', // যাতে লোকাল নেটওয়ার্কের সবাই এক্সেস পায়
    allowedHosts: [
      'jonssteel.ddns.net',
      'localdrop.jonssteel.com'
    ],
  }
})


