import { request } from './client'

// GET /api/jobs/{jobId} — 로그인(역할 무관). 직무 상세 + AI가 운영계획서에서 뽑은 값과 근거(evidence). 없으면 404 JOB_NOT_FOUND
// 통근 시간은 여기 없다 — workplace.hasCoordinates가 true면 통근 조회를 따로 부른다.
export const getJob = (jobId, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}`, { signal })
