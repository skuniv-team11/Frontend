import { request } from './client'

// 지망(STUDENT). 담은 직무와 1~3지망 순위
// GET /api/me/plan — { items: [{ jobId, title, institution, rank, addedAt }] }. 순위 있는 것(1→3) 먼저, 그다음 담은 순. 센터 계정은 403
export const getMyPlan = (signal) => request('/api/me/plan', { signal })
