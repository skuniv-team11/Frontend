import { clearToken, request } from './client'

// GET /api/me — 로그인(역할 무관). 토큰이 없거나 잘못되면 401 AUTH_REQUIRED, 만료면 401 TOKEN_EXPIRED
export const getMe = (signal) => request('/api/me', { signal })

// GET /api/me/profile — STUDENT만(CENTER는 403 FORBIDDEN_ROLE). 저장한 게 없으면 404 PROFILE_NOT_FOUND
// 응답은 화면 상태로만 들고 있는다(프로필 값은 localStorage 금지).
export const getMyProfile = (signal) => request('/api/me/profile', { signal })

// PUT /api/me/profile — STUDENT만. 프로필은 본문으로만 보낸다(URL·쿼리 금지). consent가 true가 아니면 400 CONSENT_REQUIRED
export const saveMyProfile = (profile) => request('/api/me/profile', { method: 'PUT', body: { ...profile, consent: true } })

// DELETE /api/me/profile — STUDENT만. 저장한 프로필만 지운다(계정·담은 지망은 그대로). 204
export const deleteMyProfile = () => request('/api/me/profile', { method: 'DELETE' })

// DELETE /api/me — 로그인(역할 무관). 탈퇴: 계정·프로필·담은 지망을 즉시 지운다. 204. 성공하면 토큰도 버린다
export async function deleteAccount() {
  await request('/api/me', { method: 'DELETE' })
  clearToken()
}
