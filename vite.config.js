import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 로컬(dev 5173 · preview 4173)에서 /api 요청을 Render로 넘긴다. 브라우저는 같은 주소로 보내므로 CORS가 생기지 않는다.
// 배포(Vercel)에는 영향 없음 — 거기서는 VITE_API_BASE_URL로 Render를 바로 부른다.
// 브라우저가 붙이는 Origin(localhost)은 백엔드 CORS 허용 목록에 없어 403이 나므로 넘기기 전에 뗀다.
const apiProxy = {
  '/api': {
    target: 'https://coop-radar-api.onrender.com',
    changeOrigin: true,
    configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin')),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})
