import { request } from './client'

const referenceCache = new Map()
const cachedReference = (key, path, signal) => {
  if (!referenceCache.has(key)) {
    const requestPromise = request(path, { signal }).catch(error => {
      referenceCache.delete(key)
      throw error
    })
    referenceCache.set(key, requestPromise)
  }
  return referenceCache.get(key)
}
// 기준 정보(공개). 프로필 화면의 선택지와 현황판·내 지망의 기준일에 쓴다.
// GET /api/departments — { departments: [{ id, name, college }] }
export const getDepartments = (signal) => cachedReference('departments', '/api/departments', signal)

// GET /api/areas — { areas: [{ code, sido, name }] } 서울·인천·경기 시·군·구
export const getAreas = (signal) => cachedReference('areas', '/api/areas', signal)

// GET /api/rounds/current — 현재 모집 회차와 리플레이 날짜 범위
// { termCode, roundNo, programName, recruitStart, recruitEnd, replay: { defaultAsOf, minDate, maxDate, signalsAreVirtual } }
export const getCurrentRound = (signal) => request('/api/rounds/current', { signal })

// GET /api/codes — 코드값 → 화면 표기. { size: { SME: '중소기업', … }, course: {…}, … }
export const getCodes = (signal) => request('/api/codes', { signal })
