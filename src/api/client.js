// 백엔드 주소는 빌드할 때 들어간다. VITE_로 시작하는 값은 브라우저 번들에 그대로 보이므로 키를 넣지 않는다.
// 값이 없으면(로컬) Render를 바로 부른다. 백엔드 CORS_ORIGINS가 localhost도 허용한다.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'https://coop-radar-api.onrender.com').replace(/\/$/, '')

// 백엔드가 기관 로고·소개서 사진을 API 기준 상대 경로(/logos/3.png)로 준다. 브라우저 URL로 맞춘다.
export const resolveApiAssetUrl = (path) => {
  if (!path || typeof path !== 'string') return null
  try {
    const url = new URL(path, `${API_BASE_URL}/`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

const read = (storage, key) => { try { return storage.getItem(key) } catch { return null } }
const write = (storage, key, value) => { try { if (value == null) storage.removeItem(key); else storage.setItem(key, value) } catch { /* 저장 못 해도 이번 화면은 쓴다 */ } }

// 토큰만 저장한다. 프로필 값·통근 결과는 localStorage에 두지 않는다(AGENTS.md).
// 학생(또는 가입 계정) 토큰과 센터 화면 토큰을 따로 둔다 — 같은 브라우저에서 학생·센터를 오가며 시연한다.
const TOKEN_KEY = 'accessToken'
export const getToken = () => read(localStorage, TOKEN_KEY)
export const saveToken = (token) => write(localStorage, TOKEN_KEY, token)
export const clearToken = () => write(localStorage, TOKEN_KEY, null)

const CENTER_TOKEN_KEY = 'centerAccessToken'
export const getCenterToken = () => read(localStorage, CENTER_TOKEN_KEY)
export const saveCenterToken = (token) => write(localStorage, CENTER_TOKEN_KEY, token)
export const clearCenterToken = () => write(localStorage, CENTER_TOKEN_KEY, null)

// 체험 묶음(같은 브라우저의 체험 학생 ↔ 체험 센터). 개인정보가 아닌 묶음 id와 시점만 둔다.
const DEMO_KEY = 'demoSession'
// 로그아웃·탈퇴: 학생(가입) 토큰 · 센터 토큰 · 체험 묶음을 함께 지운다(한 곳에서)
export const clearSession = () => { clearToken(); clearCenterToken(); saveDemoSession(null) }

// 토큰의 역할(JWT payload의 role). 화면 분기에만 쓰고 권한은 서버가 본다
export const tokenRole = (token) => {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))).role ?? null
  } catch {
    return null
  }
}

export const getDemoSession = () => { try { return JSON.parse(read(localStorage, DEMO_KEY) ?? 'null') } catch { return null } }
export const saveDemoSession = (session) => write(localStorage, DEMO_KEY, session ? JSON.stringify(session) : null)

// 백엔드 오류 본문 {code, message, fields?}를 그대로 들고 다닌다.
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `HTTP ${status}`)
    this.status = status
    this.code = body?.code ?? 'INTERNAL'
    this.fields = body?.fields ?? []
  }
}

async function send(path, { method = 'GET', body, signal, token: tokenOverride } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const usesOverride = tokenOverride !== undefined
  const token = usesOverride ? tokenOverride : getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, signal, body: body === undefined ? undefined : JSON.stringify(body) })
    return { res, usesOverride }
  } catch (error) {
    // 서버에 닿지 못함(주소 없음·CORS 차단·네트워크 끊김). 응답이 없으니 status는 0
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, { code: 'NETWORK', message: '서버에 연결하지 못했어요' })
  }
}

async function fail(res, usesOverride) {
  const data = await res.json().catch(() => null)
  const error = new ApiError(res.status, data)
  // 토큰이 잘못됐거나 만료됐으면(체험 계정은 계정도 지워짐) 버린다. 로그인 실패(LOGIN_FAILED)는 토큰과 상관없다.
  if (!usesOverride && (error.code === 'AUTH_REQUIRED' || error.code === 'TOKEN_EXPIRED')) clearToken()
  return error
}

// token을 넘기면 원래 로그인 토큰 대신 그 토큰을 쓴다(null이면 토큰 없이). 이때는 401이 나도 원래 토큰을 지우지 않는다.
export async function request(path, options = {}) {
  const { res, usesOverride } = await send(path, options)
  if (!res.ok) throw await fail(res, usesOverride)
  return res.status === 204 ? null : res.json().catch(() => null)
}

// 파일 응답(CSV 등). { blob, filename }
export async function requestFile(path, options = {}) {
  const { res, usesOverride } = await send(path, options)
  if (!res.ok) throw await fail(res, usesOverride)
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  const plain = /filename="?([^";]+)"?/i.exec(disposition)
  const filename = star ? decodeURIComponent(star[1]) : plain ? plain[1] : 'download'
  return { blob: await res.blob(), filename }
}

// 화면에 보일 오류 문장. 서버 message가 있으면 그것을 쓴다.
export const errorMessage = (error, fallback = '잠시 뒤 다시 시도해 주세요.') => {
  if (!error) return ''
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요.'
  if (error.code === 'AUTH_REQUIRED' || error.code === 'TOKEN_EXPIRED') return '로그인 정보가 없거나 만료됐어요. 다시 로그인해 주세요.'
  if (error.code === 'FORBIDDEN_ROLE') return '이 계정으로는 볼 수 없는 화면이에요.'
  return error.message || fallback
}
