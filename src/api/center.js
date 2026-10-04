import { request } from './client'

// 센터(CENTER만, 학생은 403 FORBIDDEN_ROLE). 모집 현황판 — 읽기 전용
// GET /api/center/board?asOf= — { asOf, isVirtual, signalSource, summary, historyAvailable, rows, alerts }
// asOf는 날짜라 쿼리로 보낸다(개인정보 아님). 생략하면 rounds/current의 replay.defaultAsOf. 모집기간 밖이면 400 AS_OF_OUT_OF_RANGE
export const getCenterBoard = (asOf, signal) => request(`/api/center/board${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`, { signal })
