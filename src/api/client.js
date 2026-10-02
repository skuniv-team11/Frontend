// 백엔드 주소는 빌드할 때 들어간다. VITE_로 시작하는 값은 브라우저 번들에 그대로 보이므로 키를 넣지 않는다.
// 값이 없으면(로컬) 같은 주소의 /api로 보내고 vite.config.js 프록시가 Render로 넘긴다.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

// 토큰만 저장한다. 프로필 값·통근 결과는 localStorage에 두지 않는다(AGENTS.md).
const TOKEN_KEY = 'accessToken'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// 백엔드 오류 본문 {code, message, fields?}를 그대로 들고 다닌다.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `HTTP ${status}`)
    this.status = status
    this.code = body?.code ?? 'INTERNAL'
    this.fields = body?.fields ?? []
  }
}

export async function request(path, { method = 'GET', body, signal } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (error) {
    // 서버에 닿지 못함(주소 없음·CORS 차단·네트워크 끊김). 응답이 없으니 status는 0
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, { code: 'NETWORK', message: '서버에 연결하지 못했어요' })
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}
