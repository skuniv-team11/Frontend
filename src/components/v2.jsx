import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, resolveApiAssetUrl } from '../api/client'

// 판정 배지 — 지원 가능(초록) · 확인 필요(주황) · 지원 불가(회색, 경고가 아니라 '해당 없음')
const VERDICT = { ELIGIBLE: ['지원 가능', 'green'], NEEDS_CHECK: ['확인 필요', 'orange'], INELIGIBLE: ['지원 불가', 'gray'] }
export function VerdictBadge({ verdict }) {
  if (!verdict) return null
  const [text, tone] = VERDICT[verdict] ?? [verdict, 'gray']
  return <span className={`badge ${tone}`}>{text}</span>
}

// 기관 로고(API 서버 /logos/N.png). 없으면 기관명 첫 글자
export function InstitutionLogo({ institution, compact = false, className = '' }) {
  const src = resolveApiAssetUrl(institution?.logoPath)
  const [failed, setFailed] = useState(false)
  return <span className={`institution-logo ${compact ? 'is-compact' : ''} ${className}`}>
    {src && !failed ? <img src={src} alt={`${institution?.name ?? '기관'} 로고`} loading="lazy" onError={() => setFailed(true)} /> : <b aria-hidden="true">{institution?.name?.[0] ?? '?'}</b>}
  </span>
}

// NCS 세분류 꼬리표
export function NcsTag({ ncs, match = false }) {
  if (!ncs) return null
  return <span className={`v2-ncs ${match ? 'is-match' : ''}`}><b>NCS</b>{ncs.name}</span>
}

// 불러오는 중 · 오류 · 빈 상태
export function Loading({ text = '불러오는 중…', note }) {
  return <div className="fx-card v2-state" role="status"><span className="v2-spinner" aria-hidden="true" /><b>{text}</b>{note && <small>{note}</small>}</div>
}

export function ErrorBox({ error, fallback, retry, children }) {
  if (!error) return null
  return <div className="fx-card v2-state is-error" role="alert"><b>{errorMessage(error, fallback)}</b>{children}{retry && <button type="button" className="fx-btn" onClick={retry}>다시 불러오기</button>}</div>
}

export function Empty({ title, children, action }) {
  return <div className="fx-card v2-state is-empty"><b>{title}</b>{children && <p>{children}</p>}{action}</div>
}

// 로그인이 필요한 화면
export function NeedLogin({ role = '학생' }) {
  return <main className="fx-page"><div className="fx-shell"><Empty title={`${role} 계정으로 로그인해야 볼 수 있어요`} action={<Link className="fx-btn primary" to="/login">로그인 · 체험 계정</Link>}>홈에서 [예시 프로필로 시작]을 누르면 가입 없이 체험할 수 있어요.</Empty></div></main>
}

// 페이지 머리
export function PageHead({ kicker, title, sub, aside }) {
  return <div className="v2-page-head"><header className="page-title">{kicker && <span>{kicker}</span>}<h1>{title}</h1>{sub && <p>{sub}</p>}</header>{aside}</div>
}

// 가상 값 표시(체험 묶음의 가상 지원자·지난 기록)
export function VirtualTag({ show = true }) {
  return show ? <span className="v2-virtual">가상</span> : null
}
