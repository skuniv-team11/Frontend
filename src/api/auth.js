import { request, saveToken } from './client'

// POST /api/auth/signup — 201 + 토큰. 이미 있으면 409 EMAIL_TAKEN, 형식 위반은 400 INVALID_INPUT
export async function signup({ email, password }) {
  const data = await request('/api/auth/signup', { method: 'POST', body: { email, password } })
  saveToken(data.accessToken)
  return data
}

// POST /api/auth/guest — 체험 계정(24시간). role: 'STUDENT'(예시 프로필 저장됨) | 'CENTER'. 호출 제한은 429 RATE_LIMITED
// 응답의 profile은 저장하지 않는다(프로필 값은 localStorage 금지). 필요하면 GET /api/me/profile로 다시 받는다.
export async function guest(role) {
  const data = await request('/api/auth/guest', { method: 'POST', body: { role } })
  saveToken(data.accessToken)
  return data
}

// POST /api/auth/login — 200 + 토큰. 틀리면 401 LOGIN_FAILED(이메일·비밀번호 중 무엇이 틀렸는지 말하지 않음)
export async function login({ email, password }) {
  const data = await request('/api/auth/login', { method: 'POST', body: { email, password } })
  saveToken(data.accessToken)
  return data
}
