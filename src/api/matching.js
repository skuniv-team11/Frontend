import { request } from './client'

// 판정·추천(STUDENT). 프로필은 요청 본문으로만 보낸다(URL·쿼리 금지) — 그래서 GET이 아니라 POST다.

// 저장된 프로필 응답(GET /api/me/profile)에서 요청 본문에 넣을 7개 값만 고른다
export const toProfileBody = (saved) => ({
  departmentId: saved.departmentId,
  grade: saved.grade,
  completedSemesters: saved.completedSemesters,
  gpa: saved.gpa,
  graduationExpected: saved.graduationExpected,
  interestText: saved.interestText ?? null,
  homeAreaCode: saved.homeAreaCode ?? null,
})

// POST /api/eligibility — 회차 직무 전부(40개)의 3층 판정. { summary, jobs: [{ jobId, verdict, majorMatch, closing, alertCount, reasons }] }
// 학과가 departments에 없으면 400 INVALID_INPUT(profile.departmentId)
export const getEligibility = (profile, signal) => request('/api/eligibility', { method: 'POST', body: { profile }, signal })

// POST /api/recommendations — 적합도 추천 상위 5개(지원 불가·기준일에 마감된 직무 제외). 점수는 주지 않는다.
// { items: [{ rank, jobId, verdict, fit, jobType, stipend, reasonTemplate, reasonStatus, citations }], blockedBy: [{ item, count }] }
// items가 비면 blockedBy에 막힌 항목별 직무 수가 온다(예: 이수 학기 40)
export const getRecommendations = (profile, signal) => request('/api/recommendations', { method: 'POST', body: { profile }, signal })
