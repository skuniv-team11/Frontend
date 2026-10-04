import { request } from './client'

// 지망(STUDENT). 담은 직무와 1~3지망 순위
// GET /api/me/plan — { items: [{ jobId, title, institution, rank, addedAt }] }. 순위 있는 것(1→3) 먼저, 그다음 담은 순. 센터 계정은 403
export const getMyPlan = (signal) => request('/api/me/plan', { signal })

// POST /api/me/plan/items — 담기. 새로 담으면 201, 이미 담겨 있으면 200(그대로). 본문 없음. 현재 회차에 없는 직무는 400 INVALID_INPUT(jobId)
export const addPlanItem = (jobId) => request('/api/me/plan/items', { method: 'POST', body: { jobId } })

// DELETE /api/me/plan/items/{jobId} — 담기 취소. 204. 담지 않은 직무면 404 PLAN_ITEM_NOT_FOUND — 이미 빠져 있는 것이니 성공으로 본다
export async function removePlanItem(jobId) {
  try {
    await request(`/api/me/plan/items/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
  } catch (error) {
    if (error.code !== 'PLAN_ITEM_NOT_FOUND') throw error
  }
}

// 담기·담기 취소 실패 문구(직무 찾기·직무 상세·내 지망이 같이 쓴다). action: '담기' | '빼기'
export const planErrorMessage = (error, action = '담기') => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인해 주세요.'
  if (error.code === 'FORBIDDEN_ROLE') return '내 지망은 학생 계정에서만 쓸 수 있어요.'
  if (error.code === 'INVALID_INPUT') return '지금 회차에서 담을 수 없는 직무예요.'
  return `${action === '빼기' ? '빼지' : '담지'} 못했어요. 잠시 뒤 다시 시도해 주세요.`
}
