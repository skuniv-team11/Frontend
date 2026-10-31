import { clearSession, request } from './client'

// #6 GET /api/me — { id, email, role, isGuest, expiresAt, hasProfile }
export const getMe = (signal) => request('/api/me', { signal })

// #7 DELETE /api/me — 탈퇴(계정·프로필·담은 지망·탐색 결과·커리어 리포트·지원서 즉시 삭제). 성공하면 토큰도 버린다
export async function deleteAccount() {
  await request('/api/me', { method: 'DELETE' })
  clearSession()
}

// #8 GET /api/me/profile — 없으면 404 PROFILE_NOT_FOUND. 화면 상태로만 들고 있는다
export const getMyProfile = (signal) => request('/api/me/profile', { signal })

// #9 PUT /api/me/profile — 동의(consent: true)할 때만 저장. 프로필은 본문으로만
export const saveMyProfile = (profile) => request('/api/me/profile', { method: 'PUT', body: { ...toProfileBody(profile), consent: true } })

// #10 DELETE /api/me/profile — 저장한 프로필만 삭제. 204
export const deleteMyProfile = () => request('/api/me/profile', { method: 'DELETE' })

// 저장된 프로필 응답에서 요청 본문에 넣을 값만 고른다
export const toProfileBody = (saved) => ({
  departmentId: saved.departmentId,
  grade: saved.grade,
  completedSemesters: saved.completedSemesters,
  gpa: saved.gpa,
  graduationExpected: saved.graduationExpected,
  interestText: saved.interestText ?? null,
  homeAreaCode: saved.homeAreaCode ?? null,
  certificates: saved.certificates ?? [],
})
