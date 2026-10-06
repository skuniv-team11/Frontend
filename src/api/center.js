import { clearCenterToken, getCenterToken, request, saveCenterToken } from './client'

// 센터(CENTER만, 학생은 403 FORBIDDEN_ROLE). 모집 현황판 — 읽기 전용
// 현황판은 원래 로그인과 따로, 센터 전용 체험 계정 토큰으로 부른다(client.js의 센터 전용 토큰).
// 토큰이 없으면 POST /api/auth/guest {role: CENTER}로 만들고, 슬라이더를 빨리 움직여도 계정은 하나만 만든다.
let pendingSession = null
const startCenterSession = () => {
  pendingSession ??= request('/api/auth/guest', { method: 'POST', body: { role: 'CENTER' }, token: null })
    .then((data) => { saveCenterToken(data.accessToken); return data.accessToken })
    .finally(() => { pendingSession = null })
  return pendingSession
}

// 센터 전용 토큰으로 부른다. 토큰이 만료(24시간)됐거나 정리됐으면(401) 새로 만들어 한 번만 다시 부른다.
async function centerRequest(path, signal) {
  const token = getCenterToken() ?? await startCenterSession()
  try {
    return await request(path, { signal, token })
  } catch (error) {
    if (error.status !== 401) throw error
    clearCenterToken()
    return request(path, { signal, token: await startCenterSession() })
  }
}

// GET /api/center/board?asOf= — { asOf, isVirtual, signalSource, summary, historyAvailable, rows, alerts }
// asOf는 날짜라 쿼리로 보낸다(개인정보 아님). 생략하면 rounds/current의 replay.defaultAsOf. 모집기간 밖이면 400 AS_OF_OUT_OF_RANGE
export const getCenterBoard = (asOf, signal) => centerRequest(`/api/center/board${asOf ? `?asOf=${encodeURIComponent(asOf)}` : ''}`, signal)

// GET /api/jobs/{jobId}/views — 현황판에서 직무 줄을 펼칠 때 센터 전용 토큰으로 부른다. 센터 담당자가 불러도 조회수는 늘지 않는다.
export const getCenterJobViews = (jobId, signal) => centerRequest(`/api/jobs/${encodeURIComponent(jobId)}/views`, signal)
