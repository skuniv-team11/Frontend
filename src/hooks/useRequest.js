import { useCallback, useEffect, useState } from 'react'

// api 함수 하나를 불러 { data, loading, error, reload, mutate }로 돌려준다. enabled가 false면 부르지 않는다.
// reload는 다시 부르고(그동안 loading, data는 이전 값 유지), mutate는 다시 부르지 않고 data만 바꾼다(저장 응답·낙관적 업데이트용).
// request는 api/ 파일에서 export한 함수를 그대로 넘긴다(매 렌더 새로 만들면 계속 다시 부른다).
export function useRequest(request, enabled = true) {
  // 어떤 request·몇 번째 호출의 결과인지 같이 들고 있다가, 지금과 같을 때만 끝난 것으로 본다(loading은 계산해서 낸다).
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({ request: null, version: -1, data: null, error: null })
  const reload = useCallback(() => setVersion((current) => current + 1), [])
  const mutate = useCallback((data) => setResult({ request, version, data, error: null }), [request, version])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    request(controller.signal)
      .then((data) => setResult({ request, version, data, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setResult({ request, version, data: null, error }) })
    return () => controller.abort()
  }, [request, enabled, version])

  if (!enabled) return { data: null, loading: false, error: null, reload, mutate }
  const done = result.request === request && result.version === version
  // reload 중(같은 request, 버전만 다름)에는 새 결과가 올 때까지 이전 data를 그대로 둔다. loading은 true
  const sameRequest = result.request === request
  return { data: sameRequest ? result.data : null, loading: !done, error: done ? result.error : null, reload, mutate }
}
