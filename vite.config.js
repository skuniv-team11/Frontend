import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 포트를 고정한다(dev 5173 · preview 4173). 이미 쓰이고 있으면 다른 포트로 넘어가지 않고 멈춘다 — 켜 둔 서버를 끄고 다시 실행.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
