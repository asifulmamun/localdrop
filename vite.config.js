import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import signalingPlugin from './vite-signaling-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), signalingPlugin()],
})


