import { clearCenterToken, getCenterToken, request, requestFile } from './client'
import { guestCenter } from './auth'

// 센터 화면은 센터 토큰으로 부른다(학생 토큰과 따로). 없으면 같은 브라우저의 체험 학생과 같은 묶음으로 체험 센터를 만든다.
// 동시에 여러 요청이 와도 계정은 하나만 만든다.
let pending = null
export const ensureCenterSession = () => {
  const token = getCenterToken()
  if (token) return Promise.resolve(token)
  pending ??= guestCenter().then((data) => data.accessToken).finally(() => { pending = null })
  return pending
}

// 토큰이 만료(24시간)됐거나 정리됐으면(401) 새로 만들어 한 번만 다시 부른다.
async function centerCall(path, options = {}, call = request) {
  const token = await ensureCenterSession()
  try {
    return await call(path, { ...options, token })
  } catch (error) {
    if (error.status !== 401) throw error
    clearCenterToken()
    return call(path, { ...options, token: await ensureCenterSession() })
  }
}

// #24 GET /api/center/board — 처리할 것(todo) · 직무별 조건·위험 요인 · 검토 알림 · 학생이 찾는 직무(demand)
export const getCenterBoard = (signal) => centerCall('/api/center/board', { signal })

// #46 GET /api/center/applications — 들어온 지원서(접수번호 순)와 상태별 수
export const getCenterApplications = (signal) => centerCall('/api/center/applications', { signal })

// #47 GET /api/center/applications/{id} — 지원서 한 부(제5호 서식 보기·인쇄)
export const getCenterApplication = (id, signal) => centerCall(`/api/center/applications/${encodeURIComponent(id)}`, { signal })

// #48 PUT /api/center/applications/{id}/status — { status: RECEIVED | FIX_REQUESTED, reason? (보완 요청은 5~300자) }
export const setApplicationStatus = (id, status, reason) => centerCall(`/api/center/applications/${encodeURIComponent(id)}/status`, { method: 'PUT', body: reason ? { status, reason } : { status } })

// #49 GET /api/center/placement — 매칭 고르기 · 직무별 매칭 수와 정원 · 면접 일정 · 결과
export const getPlacement = (signal) => centerCall('/api/center/placement', { signal })

// #50 PUT /api/center/applications/{id}/match — { rank: 1~3 | null(취소) }
export const setMatch = (id, rank) => centerCall(`/api/center/applications/${encodeURIComponent(id)}/match`, { method: 'PUT', body: { rank } })

// #51 POST /api/center/placement/confirm — 매칭 확정(학생에게 보임). 접수 완료가 모두 골라져야 함(아니면 409)
export const confirmPlacement = () => centerCall('/api/center/placement/confirm', { method: 'POST' })

// #52 PUT /api/center/applications/{id}/selection — { interviewAt, interviewMode: IN_PERSON|ONLINE|…, result: WAIT|PASS|FAIL }
export const setSelection = (id, body) => centerCall(`/api/center/applications/${encodeURIComponent(id)}/selection`, { method: 'PUT', body })

// #53 POST /api/center/placement/notify — 결과 알림(학생에게 보임). WAIT가 남아 있으면 409
export const notifyPlacement = () => centerCall('/api/center/placement/notify', { method: 'POST' })

// #54 GET /api/center/close — 학생 서류 · 기관 서류 · 학과(부)장 승인 · 안 낸 것
export const getCenterClose = (signal) => centerCall('/api/center/close', { signal })

// #55 PUT /api/center/close/{id} — 기관 서류 받음 표시 { evaluation, attendance }
export const setCloseDocuments = (id, body) => centerCall(`/api/center/close/${encodeURIComponent(id)}`, { method: 'PUT', body })

// #56 POST /api/center/close/remind — 학생 서류를 안 낸 학생에게 알림
export const remindClose = () => centerCall('/api/center/close/remind', { method: 'POST' })

// #57 GET /api/center/close/credits.csv — 학점 인정·장학금 명단 CSV. { blob, filename }
export const downloadCreditsCsv = () => centerCall('/api/center/close/credits.csv', {}, requestFile)

// #58 POST /api/center/demo/advance — 시연 버튼(체험 센터만). { to: RECEIVED | MATCHED | SELECTED | CLOSING }
export const advanceDemo = (to) => centerCall('/api/center/demo/advance', { method: 'POST', body: { to } })

// 파일 저장(브라우저 다운로드)
export const saveBlob = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
