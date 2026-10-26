import { request } from './client'

// #37 GET /api/me/application — 내 지원서(별지 제5호). 없으면 프로필·담은 지망으로 미리 채운 빈 지원서(status: NONE)
export const getMyApplication = (signal) => request('/api/me/application', { signal })

// #38 PUT /api/me/application — 임시 저장. consents.collect 필수(아니면 400 CONSENT_REQUIRED), 낸 뒤에는 409 APPLICATION_LOCKED
// 본문: { applicant, resume, essays[4], pledge, consents: {collect, thirdParty}, signature }
export const saveMyApplication = (body) => request('/api/me/application', { method: 'PUT', body })

// #39 DELETE /api/me/application — 내기 전(DRAFT)만. 낸 뒤 409 APPLICATION_LOCKED
export const deleteMyApplication = () => request('/api/me/application', { method: 'DELETE' })

// #40 POST /api/me/application/approval — 학과(부)장 승인 링크 만들기(지금 내용 기준, 다시 부르면 새 링크)
export const requestApproval = () => request('/api/me/application/approval', { method: 'POST' })

// #41 POST /api/me/application/submit — 내기. 빠진 것 400 APPLICATION_INCOMPLETE(fields[].field = 항목 코드), 기간 밖 409 APPLICATION_CLOSED
export const submitMyApplication = () => request('/api/me/application/submit', { method: 'POST' })

// #42 GET /api/approvals/{token} — 공개. 학과(부)장이 승인할 내용. 없거나 닫힌 링크 404 APPROVAL_NOT_FOUND
export const getApproval = (token, signal) => request(`/api/approvals/${encodeURIComponent(token)}`, { signal, token: null })

// #43 POST /api/approvals/{token} — 공개. 승인. 내용이 바뀐 링크(STALE)는 409 STATE_CONFLICT
export const approve = (token) => request(`/api/approvals/${encodeURIComponent(token)}`, { method: 'POST', token: null })

// 승인 링크의 화면 주소(학생이 학과 사무실에 전한다). 미리보기·로컬에서 만들어도 공개 주소로 만든다(백엔드는 하나라 그대로 열린다)
const PUBLIC_ORIGIN = (import.meta.env.VITE_PUBLIC_ORIGIN ?? 'https://fieldrun.pages.dev').replace(/\/$/, '')
export const approvalUrl = (token) => `${PUBLIC_ORIGIN}/approvals/${token}`
