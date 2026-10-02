// 백엔드 주소는 빌드할 때 들어간다. VITE_로 시작하는 값은 브라우저 번들에 그대로 보이므로 키를 넣지 않는다.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '')

export async function request(path, options) {
  const res = await fetch(`${API_BASE_URL}${path}`, options)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
