import { request } from './client'

// GET /api/jobs/{jobId} — 로그인(역할 무관). 직무 상세 + AI가 운영계획서에서 뽑은 값과 근거(evidence). 없으면 404 JOB_NOT_FOUND
// 통근 시간은 여기 없다 — workplace.hasCoordinates가 true면 통근 조회를 따로 부른다.
export const getJob = (jobId, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}`, { signal })

// POST /api/jobs/{jobId}/commute — 로그인(역할 무관). 카카오맵 대중교통 통근 시간. 본문은 { homeAreaCode } 하나(null이면 서경대 출발)
// 실패해도 200 + available: false(unavailableReason: NO_WORKPLACE · NO_ROUTE · LIMITED · PROVIDER_ERROR). 결과는 저장하지 않는다 — 화면 상태로만 든다.
export const getCommute = (jobId, homeAreaCode, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}/commute`, { method: 'POST', body: { homeAreaCode }, signal })
