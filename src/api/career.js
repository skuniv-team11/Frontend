import { request } from './client'

// #34 POST /api/me/career-report — 수행결과보고서 '실습 내용'(100~3,000자) → 다룬 NCS 능력단위(AI, 구절 대조)
// AI가 답하지 못하면 200 + source: NONE. 저장한 AI 리포트는 잠깐의 실패로 덮어쓰지 않는다(keptReason)
export const createCareerReport = ({ jobId, practiceText }) => request('/api/me/career-report', { method: 'POST', body: { jobId, practiceText, consent: true } })

// #35 GET /api/me/career-report — 저장본. 없으면 404 CAREER_REPORT_NOT_FOUND
export const getCareerReport = (signal) => request('/api/me/career-report', { signal })

// #36 DELETE /api/me/career-report — 204
export const deleteCareerReport = () => request('/api/me/career-report', { method: 'DELETE' })
