// 백엔드 주소는 빌드할 때 들어간다. VITE_로 시작하는 값은 브라우저 번들에 그대로 보이므로 키를 넣지 않는다.
// 값이 없으면(로컬) Render를 바로 부른다. 백엔드 CORS_ORIGINS가 localhost도 허용한다.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'https://coop-radar-api.onrender.com').replace(/\/$/, '')

// 백엔드가 기관 로고를 절대 URL 또는 API 기준 상대 경로로 줄 수 있어 두 형태를 모두 브라우저 URL로 맞춘다.
export const resolveApiAssetUrl = (path) => {
  if (!path || typeof path !== 'string') return null
  try {
    const url = new URL(path, `${API_BASE_URL}/`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

// 토큰만 저장한다. 프로필 값·통근 결과는 localStorage에 두지 않는다(AGENTS.md).
const TOKEN_KEY = 'accessToken'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

// 센터 현황판 전용 토큰. 원래 로그인 토큰(accessToken)은 건드리지 않고 현황판 요청에만 쓴다 —
// 현황판에서 나가면 다른 화면은 원래 토큰을 그대로 쓰므로 따로 되돌릴 게 없다. 탭을 닫으면 사라진다(sessionStorage).
const CENTER_TOKEN_KEY = 'centerAccessToken'
export const getCenterToken = () => { try { return sessionStorage.getItem(CENTER_TOKEN_KEY) } catch { return null } }
export const saveCenterToken = (token) => { try { sessionStorage.setItem(CENTER_TOKEN_KEY, token) } catch { /* 저장 못 해도 이번 요청에는 쓴다 */ } }
export const clearCenterToken = () => { try { sessionStorage.removeItem(CENTER_TOKEN_KEY) } catch { /* 무시 */ } }

// 백엔드 오류 본문 {code, message, fields?}를 그대로 들고 다닌다.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `HTTP ${status}`)
    this.status = status
    this.code = body?.code ?? 'INTERNAL'
    this.fields = body?.fields ?? []
  }
}

// token을 넘기면 원래 로그인 토큰 대신 그 토큰을 쓴다(null이면 토큰 없이). 이때는 401이 나도 원래 토큰을 지우지 않는다.
export async function request(path, { method = 'GET', body, signal, token: tokenOverride } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const usesOverride = tokenOverride !== undefined
  const token = usesOverride ? tokenOverride : getToken()
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
  if (!res.ok) {
    const error = new ApiError(res.status, data)
    // 토큰이 잘못됐거나 만료됐으면(체험 계정은 계정도 지워짐) 버린다. 로그인 실패(LOGIN_FAILED)는 토큰과 상관없다.
    if (!usesOverride && (error.code === 'AUTH_REQUIRED' || error.code === 'TOKEN_EXPIRED')) clearToken()
    throw error
  }
  return data
}
