import { request } from './client'

const cache = new Map()
const cached = (key, path, signal) => {
  if (!cache.has(key)) cache.set(key, request(path, { signal: undefined, token: null }).catch((error) => { cache.delete(key); throw error }))
  void signal
  return cache.get(key)
}

// #1 GET /api/ping — 배포 연결 확인
export const ping = (signal) => request('/api/ping', { signal, token: null })

// #2 GET /api/codes — 코드값 → 화면 표기 { verdict: {ELIGIBLE: '지원 가능', …}, … }
export const getCodes = (signal) => cached('codes', '/api/codes', signal)

// #11 GET /api/departments — { departments: [{ id, name, college }] }
export const getDepartments = (signal) => cached('departments', '/api/departments', signal)

// #12 GET /api/areas — { areas: [{ code, sido, name }] }
export const getAreas = (signal) => cached('areas', '/api/areas', signal)

// #13 GET /api/rounds/current — 회차 · 리플레이 기준일 · 일정 11단계(stages)
export const getCurrentRound = (signal) => cached('round', '/api/rounds/current', signal)

// #26 GET /api/certificates — { certificates: [{ code, label }] }
export const getCertificates = (signal) => cached('certificates', '/api/certificates', signal)

// 코드 표기 하나. 없으면 코드 그대로
export const label = (codes, group, code) => (code == null ? '' : codes?.[group]?.[code] ?? code)
