import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { clearSession, errorMessage, getDemoSession, getToken } from '../api/client'
import { fmtDate } from '../lib/format'
import { advanceDemo } from '../api/center'
import { getMe, getMyProfile } from '../api/me'

const STUDENT_NAV = [['/', '홈', true], ['/explore', '직무 탐색'], ['/jobs', '직무 찾기'], ['/internship', '내 현장실습']]
const ME_MENU = [['/me', '내 프로필'], ['/me?tab=saved', '담은 직무'], ['/me?tab=apply', '지원서'], ['/me?tab=career', '커리어 리포트']]
const CENTER_NAV = [['/center', '현황판', true], ['/center/inbox', '접수함'], ['/center/match', '매칭 · 선발'], ['/center/close', '마무리']]
const DEMO_STEPS = [['RECEIVED', '접수까지'], ['MATCHED', '매칭 확정까지'], ['SELECTED', '선발 결과 알림까지'], ['CLOSING', '마무리 서류까지']]

// 센터 화면이 다시 불러오게 알린다(시연 버튼 뒤)
export const DEMO_EVENT = 'v2:demo-advanced'

function DemoMenu() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const run = async (to) => {
    setBusy(to); setMessage('')
    try {
      await advanceDemo(to)
      setMessage('진행했어요. 화면을 다시 불러와요.')
      window.dispatchEvent(new Event(DEMO_EVENT))
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  return <div className="v2-demo-menu" ref={ref}>
    <button type="button" className="v2-switch" aria-expanded={open} onClick={() => setOpen((v) => !v)}>시연 ▾</button>
    {open && <div className="v2-demo-pop">
      <p>기관이 할 일과 앞 단계를 한 번에 진행해요(체험 센터만). 보완 요청 중인 지원서는 그대로 둬요.</p>
      {DEMO_STEPS.map(([to, text]) => <button key={to} type="button" disabled={Boolean(busy)} onClick={() => run(to)}><span>{text}</span><small>{busy === to ? '진행 중…' : '→'}</small></button>)}
      {message && <p role="status">{message}</p>}
    </div>}
  </div>
}

export function Header({ center = false, hidden = false }) {
  const location = useLocation()
  const token = getToken()
  const loggedIn = Boolean(token)
  const [isHomeTop, setIsHomeTop] = useState(location.pathname === '/' && window.scrollY < 12)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuAccount, setMenuAccount] = useState(null)
  const profileMenuRef = useRef(null)
  const logout = () => {
    clearSession()
    window.location.replace('/')
  }

  useEffect(() => {
    const updateTopbar = () => setIsHomeTop(location.pathname === '/' && window.scrollY < 12)
    updateTopbar()
    window.addEventListener('scroll', updateTopbar, { passive: true })
    return () => window.removeEventListener('scroll', updateTopbar)
  }, [location.pathname])

  useEffect(() => {
    if (!profileOpen) return undefined
    const close = (event) => { if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [profileOpen])

  useEffect(() => {
    if (!profileOpen || !token || menuAccount?.token === token) return undefined
    const controller = new AbortController()
    ;(async () => {
      try {
        const me = await getMe(controller.signal)
        let profile = null
        if (me.role === 'STUDENT') {
          try { profile = await getMyProfile(controller.signal) } catch (error) { if (error.name === 'AbortError') throw error }
        }
        setMenuAccount({ token, me, profile })
      } catch (error) {
        if (error.name !== 'AbortError') setMenuAccount({ token, me: null, profile: null })
      }
    })()
    return () => controller.abort()
  }, [menuAccount?.token, profileOpen, token])

  const nav = center ? CENTER_NAV : STUDENT_NAV

  return <header aria-hidden={hidden} className={`topbar ${isHomeTop && !center ? 'home-topbar' : ''} ${hidden ? 'topbar-hidden' : ''}`}>
    {/* 로고는 어느 화면에서든 메인(/)으로, 센터 이름표는 현황판으로 */}
    <span style={{ display: 'inline-flex', alignItems: 'baseline' }}><Link className="brand" to="/">현장뛰자<span>.</span></Link>{center && <Link to="/center" style={{ marginLeft: 8, color: '#626b78', fontSize: 12, fontWeight: 800 }}>현장실습지원센터</Link>}</span>
    <nav>{nav.map(([to, text, end]) => <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive || (to === '/internship' && /^\/(apply|career)/.test(location.pathname)) || (to === '/explore' && location.pathname.startsWith('/explore')) || (to === '/center/inbox' && location.pathname.startsWith('/center/inbox')) ? 'active' : '')}>{text}</NavLink>)}</nav>
    {center ? <div className="v2-top-actions"><DemoMenu /><Link className="v2-switch" to="/">학생 화면 →</Link></div>
      : loggedIn ? <div className="v2-top-actions"><Link className="v2-switch" to="/center">센터 화면 →</Link><div className="profile-menu" ref={profileMenuRef}>
        <button className="profile-menu-trigger" type="button" aria-label="내 정보 메뉴" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
          <span className="profile-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6" /></svg></span>
        </button>
        {profileOpen && <div className="profile-popover">
          <div className="profile-popover-summary">
            <span className="profile-summary-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6" /></svg></span>
            <div>{menuAccount?.me ? <><b>{menuAccount.me.isGuest ? '체험 계정' : menuAccount.me.email}</b><span>{menuAccount.me.role === 'CENTER' ? '현장실습지원센터 담당자' : menuAccount.profile ? `${menuAccount.profile.department?.name ?? '학과 정보 없음'}${menuAccount.profile.grade ? ` · ${menuAccount.profile.grade}학년` : ''}` : '프로필 없음'}</span></> : <><b>계정 정보</b><span>{menuAccount?.token === token ? '정보를 불러오지 못했어요' : '불러오는 중…'}</span></>}</div>
          </div>
          {/* 내 정보(/me) 왼쪽 메뉴와 같은 네 개 — 누르면 /me의 그 탭이 열린다 */}
          {ME_MENU.map(([to, text]) => <Link key={to} to={to} onClick={() => setProfileOpen(false)}><span>{text}</span><b>›</b></Link>)}
          <button className="profile-popover-logout" type="button" onClick={logout}>로그아웃</button>
        </div>}
      </div></div> : <div className="v2-top-actions"><Link className="v2-switch" to="/center">센터 화면 →</Link><Link className="top-action" to="/login">로그인</Link></div>}
  </header>
}

// 체험 학생 시점 표시(상단 띠). 시점을 바꾸면 새 체험 계정을 만든다.
export function DemoBanner({ onSwitch }) {
  const demo = getDemoSession()
  if (!demo?.stage || !getToken()) return null
  // 날짜는 체험 계정을 만들 때 받은 시점의 날(demoToday)
  const label = [{ APPLYING: '지원 중', PRACTICING: '실습 중', DONE: '실습 마친 뒤' }[demo.stage] ?? demo.stage, demo.demoToday ? fmtDate(demo.demoToday) : null].filter(Boolean).join(' · ')
  return <div className="v2-demo-banner">체험 계정 · 시점 {label} · 가상 데이터가 섞여 있어요 <button type="button" onClick={onSwitch}>시점 바꾸기</button></div>
}
