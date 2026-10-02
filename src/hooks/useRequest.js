import { useCallback, useEffect, useState } from 'react'

// api 함수 하나를 불러 { data, loading, error, reload }로 돌려준다. enabled가 false면 부르지 않는다.
// request는 api/ 파일에서 export한 함수를 그대로 넘긴다(매 렌더 새로 만들면 계속 다시 부른다).
export function useRequest(request, enabled = true) {
  // 어떤 request·몇 번째 호출의 결과인지 같이 들고 있다가, 지금과 같을 때만 끝난 것으로 본다(loading은 계산해서 낸다).
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({ request: null, version: -1, data: null, error: null })
  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    request(controller.signal)
      .then((data) => setResult({ request, version, data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setResult({ request, version, data: null, error }) })
    return () => controller.abort()
  }, [request, enabled, version])

  if (!enabled) return { data: null, loading: false, error: null, reload }
  const done = result.request === request && result.version === version
  return { data: done ? result.data : null, loading: !done, error: done ? result.error : null, reload }
}
