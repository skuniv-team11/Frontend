import { getToken, request } from './client'

// 탐색 글과 설명은 영구 저장소에 두지 않는다. 현재 탭 메모리에서만 계정·탐색 시점·직무별로 재사용한다.
const whyCache = new Map()
const whyCacheKey = (jobId, exploreCreatedAt) => {
  const token = getToken()
  return token && exploreCreatedAt ? JSON.stringify([token, exploreCreatedAt, String(jobId)]) : null
}
export const getCachedExploreWhy = (jobId, exploreCreatedAt) => {
  const key = whyCacheKey(jobId, exploreCreatedAt)
  return key ? whyCache.get(key) ?? null : null
}

// #28 POST /api/explore/cards — '하고 싶은 일' 카드(후보 직무의 하는 일, 회사 이름 가림). profile을 빼면 저장한 프로필
// { candidates: {total, eligible, needsCheck}, cards: [{ id: '101-4', text, … }] }
export const getExploreCards = (signal, profile) => request('/api/explore/cards', { method: 'POST', body: profile ? { profile } : {}, signal })

// #29 POST /api/explore — 경험 글 0~3개(20~200자) · 카드 0~5개(경험 1개 또는 카드 3개 이상), consent 필수
// AI가 짝·종류를 찾고 규칙이 순서(0~5곳). 실패하면 규칙 추천(source: RULE). 약 5~15초
export const runExplore = async ({ experiences, cardIds, profile }) => {
  const result = await request('/api/explore', {
    method: 'POST',
    body: { ...(profile ? { profile } : {}), experiences, cardIds, consent: true },
  })
  whyCache.clear()
  return result
}

// #30 GET /api/me/explore — 저장된 탐색 결과(저장한 프로필로 다시 판정). 없으면 404 EXPLORE_NOT_FOUND
export const getMyExplore = (signal) => request('/api/me/explore', { signal })

// #31 DELETE /api/me/explore — 탐색 결과·경험 글 지우기. 204
export const deleteMyExplore = async () => {
  const result = await request('/api/me/explore', { method: 'DELETE' })
  whyCache.clear()
  return result
}

// #32 GET /api/me/explore/jobs/{jobId}/why — '왜 맞나요'(없으면 이때 만든다). { jobId, fit, why, fallbackReason }
// 탐색 결과 없음 404 EXPLORE_NOT_FOUND · 후보 아님 409 EXPLORE_NOT_CANDIDATE
export const getExploreWhy = async (jobId, signal, exploreCreatedAt) => {
  const key = whyCacheKey(jobId, exploreCreatedAt)
  if (key && whyCache.has(key)) return whyCache.get(key)
  const result = await request(`/api/me/explore/jobs/${encodeURIComponent(jobId)}/why`, { signal })
  if (key && result?.why) whyCache.set(key, result)
  return result
}
