import { errorMessage, request } from './client'

// #19 GET /api/me/plan — { items: [{ jobId, title, institution, rank, addedAt, … }] } 순위 있는 것 먼저
export const getMyPlan = (signal) => request('/api/me/plan', { signal })

// #20 POST /api/me/plan/items — 담기. 새로 201, 이미 200
export const addPlanItem = (jobId) => request('/api/me/plan/items', { method: 'POST', body: { jobId } })

// #21 DELETE /api/me/plan/items/{jobId} — 담기 취소. 없으면 404 PLAN_ITEM_NOT_FOUND → 이미 빠진 것이니 성공으로 본다
export async function removePlanItem(jobId) {
  try {
    await request(`/api/me/plan/items/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
  } catch (error) {
    if (error.code !== 'PLAN_ITEM_NOT_FOUND') throw error
  }
}

// #22 PUT /api/me/plan/ranks — 순위 '전체'를 보낸다 [{ jobId, rank }]. 1~3·중복 불가·담은 직무만(아니면 400 RANK_INVALID)
export const saveRanks = (ranks) => request('/api/me/plan/ranks', { method: 'PUT', body: { ranks } })

export const planErrorMessage = (error, action = '담기') => {
  if (error.code === 'INVALID_INPUT') return '지금 회차에서 담을 수 없는 직무예요.'
  if (error.code === 'RANK_INVALID') return '1~3지망은 담은 직무 중에서 겹치지 않게 정해 주세요.'
  if (error.code === 'NETWORK' || error.status === 401 || error.code === 'FORBIDDEN_ROLE') return errorMessage(error)
  return `${action === '빼기' ? '빼지' : '담지'} 못했어요. 잠시 뒤 다시 시도해 주세요.`
}
