import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom'
import { API_BASE_URL, fetchPing, type Ping } from './api'

// E4 배포 연결 확인용 화면. 실제 화면은 기능 명세·와이어프레임 이후에 만든다.
function HealthPage() {
  const [ping, setPing] = useState<Ping | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchPing(ctrl.signal)
      .then(setPing)
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e))
      })
    return () => ctrl.abort()
  }, [])

  return (
    <main className="page">
      <h1>현장뛰자</h1>
      <p className="muted">배포 연결 확인</p>
      <dl>
        <dt>API 주소</dt>
        <dd><code>{API_BASE_URL}</code></dd>
        <dt>백엔드 응답</dt>
        <dd>
          {ping && <span className="ok">✓ {ping.status} · {ping.time}</span>}
          {error && <span className="err">✗ {error} (주소·CORS·백엔드 기동 확인)</span>}
          {!ping && !error && '확인 중…'}
        </dd>
      </dl>
      <p>
        <Link to="/jobs/sample">하위 경로 이동</Link> 후 새로고침해도 404가 나지 않으면 vercel.json rewrite가 동작하는 것입니다.
      </p>
    </main>
  )
}

function JobPlaceholder() {
  const { id } = useParams()
  return (
    <main className="page">
      <h1>직무 상세 (자리표시)</h1>
      <p>id: <code>{id}</code></p>
      <Link to="/">처음으로</Link>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HealthPage />} />
        <Route path="/jobs/:id" element={<JobPlaceholder />} />
      </Routes>
    </BrowserRouter>
  )
}
