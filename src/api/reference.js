import { request } from './client'

// 기준 정보(공개). 프로필 화면의 선택지로 쓴다.
// GET /api/departments — { departments: [{ id, name, college }] }
export const getDepartments = (signal) => request('/api/departments', { signal })

// GET /api/areas — { areas: [{ code, sido, name }] } 서울·인천·경기 시·군·구
export const getAreas = (signal) => request('/api/areas', { signal })
