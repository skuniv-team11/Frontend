import { useCallback } from 'react'
import { useRequest } from './useRequest'

const MAX_PARALLEL = 10

// 직무 여러 개의 조회수를 한꺼번에 불러 { [jobId]: { views, todayViews } }로 돌려준다.
// 목록에서 상세에 들어가기 전에 조회수를 보여 주려고 쓴다. 한 번에 10개씩 부르고, 실패한 직무는 빼고 나머지만 보여 준다.
// fetchViews는 api/ 파일의 함수를 그대로 넘긴다(학생 화면 getJobViews, 현황판 getCenterJobViews).
export function useJobViews(jobIds, fetchViews, enabled = true) {
  const key = [...new Set(jobIds)].join(',')
  const load = useCallback(async (signal) => {
    const ids = key.split(',').filter(Boolean)
    const result = {}
    for (let start = 0; start < ids.length; start += MAX_PARALLEL) {
      const settled = await Promise.allSettled(ids.slice(start, start + MAX_PARALLEL).map((id) => fetchViews(id, signal)))
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      for (const item of settled) if (item.status === 'fulfilled') result[item.value.jobId] = item.value
    }
    return result
  }, [key, fetchViews])
  return useRequest(load, enabled && key.length > 0)
}
