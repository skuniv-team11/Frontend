import { request } from './client'

// 기준 정보(공개). 프로필 화면의 선택지와 현황판·내 지망의 기준일에 쓴다.
// GET /api/departments — { departments: [{ id, name, college }] }
export const getDepartments = (signal) => request('/api/departments', { signal })

// GET /api/areas — { areas: [{ code, sido, name }] } 서울·인천·경기 시·군·구
export const getAreas = (signal) => request('/api/areas', { signal })

// GET /api/rounds/current — 현재 모집 회차와 리플레이 날짜 범위
// { termCode, roundNo, programName, recruitStart, recruitEnd, replay: { defaultAsOf, minDate, maxDate, signalsAreVirtual } }
export const getCurrentRound = (signal) => request('/api/rounds/current', { signal })
