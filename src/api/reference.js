import { request } from './client'

const referenceCache = new Map()
const cachedReference = async (key, path, signal) => {
  if (referenceCache.has(key)) return referenceCache.get(key)
  const data = await request(path, { signal })
  referenceCache.set(key, data)
  return data
}
// 기준 정보(공개). 프로필 화면의 선택지와 현황판·내 지망의 기준일에 쓴다.
// GET /api/departments — { departments: [{ id, name, college }] }
export const getDepartments = (signal) => cachedReference('departments', '/api/departments', signal)

// GET /api/areas — { areas: [{ code, sido, name }] } 서울·인천·경기 시·군·구
export const getAreas = (signal) => cachedReference('areas', '/api/areas', signal)

// GET /api/certificates — { certificates: [{ code, label }] } 이번 회차 직무가 요구·우대하는 자격증만(2026-2는 2개, ADR-0021)
// 프로필의 '가진 자격증' 체크 목록으로 쓴다. 고른 code 목록을 프로필 certificates로 보낸다
export const getCertificates = (signal) => cachedReference('certificates', '/api/certificates', signal)

// GET /api/rounds/current — 현재 모집 회차와 리플레이 날짜 범위
// { termCode, roundNo, programName, recruitStart, recruitEnd, replay: { defaultAsOf }, stages: [{ code, phase, startsOn, endsOn, confirmed, source }] }
// replay.minDate·maxDate는 백엔드에서 빠졌다 — 날짜 범위는 recruitStart~recruitEnd를 쓴다
export const getCurrentRound = (signal) => request('/api/rounds/current', { signal })

// GET /api/codes — 코드값 → 화면 표기. { size: { SME: '중소기업', … }, course: {…}, … }
export const getCodes = (signal) => request('/api/codes', { signal })
