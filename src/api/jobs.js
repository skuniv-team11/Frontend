import { request } from './client'

// #14 POST /api/eligibility — 회차 직무 전부의 3층 판정. profile을 빼면 저장한 프로필로 본다(없으면 404 PROFILE_NOT_FOUND)
// { summary, jobs: [{ jobId, title, team, institution, verdict, majorMatch, closing, alertCount, reasons, ncs, views, planned, planRank, … }] }
export const getEligibility = (signal, profile) => request('/api/eligibility', { method: 'POST', body: profile ? { profile } : {}, signal })

// #17 GET /api/jobs/{jobId} — 직무 상세 + AI 근거·선배 수기 전문·소개서 사진·myEligibility
export const getJob = (jobId, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}`, { signal })

// #18 POST /api/jobs/{jobId}/commute — 카카오 대중교통. 실패해도 200 + available: false. 저장하지 않는다
export const getCommute = (jobId, homeAreaCode, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}/commute`, { method: 'POST', body: { homeAreaCode: homeAreaCode ?? null }, signal })

// #33 GET /api/jobs/{jobId}/career — NCS 세분류·능력단위, 넓혀 갈 직무 3개, 이어지는 직업
export const getJobCareer = (jobId, signal) => request(`/api/jobs/${encodeURIComponent(jobId)}/career`, { signal })
