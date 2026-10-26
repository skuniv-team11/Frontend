import { clearCenterToken, getDemoSession, request, saveCenterToken, saveDemoSession, saveToken } from './client'

// #3 POST /api/auth/signup — 201 + 토큰. 이미 있으면 409 EMAIL_TAKEN, 형식 위반은 400 INVALID_INPUT
export async function signup({ email, password }) {
  const data = await request('/api/auth/signup', { method: 'POST', body: { email, password }, token: null })
  saveToken(data.accessToken)
  return data
}

// #4 POST /api/auth/login — 200 + 토큰. 틀리면 401 LOGIN_FAILED
export async function login({ email, password }) {
  const data = await request('/api/auth/login', { method: 'POST', body: { email, password }, token: null })
  saveToken(data.accessToken)
  return data
}

// #5 POST /api/auth/guest — 체험 학생. stage: APPLYING(7/23 지원 중) · PRACTICING(10/14 실습 중) · DONE(12/17 마친 뒤)
// 새 체험 학생은 새 묶음으로 시작한다(같은 브라우저의 체험 센터는 이 묶음으로 다시 만든다).
// 응답의 profile은 저장하지 않는다(프로필 값은 localStorage 금지).
export async function guestStudent(stage = 'APPLYING') {
  const data = await request('/api/auth/guest', { method: 'POST', body: { role: 'STUDENT', stage, demoGroup: null }, token: null })
  saveToken(data.accessToken)
  clearCenterToken()
  saveDemoSession({ demoGroup: data.demoGroup ?? null, demoToday: data.demoToday ?? null, stage })
  return data
}

// #5 체험 센터 — 같은 브라우저의 체험 학생과 같은 묶음(demoGroup)으로 만든다. 체험 학생이 낸 지원서가 이 접수함에 들어온다.
export async function guestCenter() {
  const demo = getDemoSession()
  const data = await request('/api/auth/guest', { method: 'POST', body: { role: 'CENTER', demoGroup: demo?.demoGroup ?? null }, token: null })
  saveCenterToken(data.accessToken)
  saveDemoSession({ ...(demo ?? {}), demoGroup: data.demoGroup ?? demo?.demoGroup ?? null })
  return data
}
