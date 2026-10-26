import { request } from './client'

// #44 GET /api/me/internship?asOf= — 일정 11단계 · 담은 직무 · 지원서 · 매칭·선발 · 실습 주차 · 마무리 서류
// 기준일 = asOf → 체험 학생의 demoToday → 오늘
export const getMyInternship = (signal, asOf) => request(`/api/me/internship${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`, { signal })

// #45 PUT /api/me/internship/documents/{kind} — 마무리 서류 냄 표시. kind: REPORT · CREDIT · SURVEY
// 합격 알림 전 409 STATE_CONFLICT, REPORT는 커리어 리포트가 없으면 409 CAREER_REPORT_REQUIRED
export const markDocument = (kind) => request(`/api/me/internship/documents/${encodeURIComponent(kind)}`, { method: 'PUT' })
