import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getToken } from '../api/client'
import { getMe, getMyProfile } from '../api/myInfo'

export function Header({ center = false, hidden = false }) {
  const location = useLocation()
  const navigate = useNavigate()
  const token = getToken()
  const loggedIn = Boolean(token)
  const [isHomeTop, setIsHomeTop] = useState(location.pathname === '/' && window.scrollY < 12)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuAccount, setMenuAccount] = useState(null)
  const profileMenuRef = useRef(null)
  const logout = () => {
    clearToken()
    setProfileOpen(false)
    navigate('/')
  }

  useEffect(() => {
    const updateTopbar = () => setIsHomeTop(location.pathname === '/' && window.scrollY < 12)
    updateTopbar()
    window.addEventListener('scroll', updateTopbar, { passive: true })
    return () => window.removeEventListener('scroll', updateTopbar)
  }, [location.pathname])

  useEffect(() => {
    if (!profileOpen) return undefined
    const closeProfileMenu = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false)
    }
    document.addEventListener('pointerdown', closeProfileMenu)
    return () => document.removeEventListener('pointerdown', closeProfileMenu)
  }, [profileOpen])

  useEffect(() => {
    if (!profileOpen || !token || menuAccount?.token === token) return undefined
    const controller = new AbortController()
    const loadAccount = async () => {
      try {
        const me = await getMe(controller.signal)
        let profile = null
        if (me.role === 'STUDENT') {
          try { profile = await getMyProfile(controller.signal) }
          catch (error) { if (error.name === 'AbortError') throw error }
        }
        setMenuAccount({ token, me, profile })
      } catch (error) {
        if (error.name !== 'AbortError') setMenuAccount({ token, me: null, profile: null })
      }
    }
    loadAccount()
    return () => controller.abort()
  }, [menuAccount?.token, profileOpen, token])

  return <header aria-hidden={hidden} className={`topbar ${isHomeTop ? 'home-topbar' : ''} ${hidden ? 'topbar-hidden' : ''}`}>
    <Link className="brand" to="/">현장뛰자<span>.</span></Link>
    <nav>{center ? <b>현장실습지원센터</b> : <><NavLink to="/" end>홈</NavLink><NavLink to="/jobs">직무 찾기</NavLink></>}</nav>
    {center ? <Link className="top-action" to="/">학생 화면</Link> : loggedIn ? <div className="profile-menu" ref={profileMenuRef}>
      <button className="profile-menu-trigger" type="button" aria-label="내 정보 메뉴" aria-expanded={profileOpen} onClick={() => setProfileOpen(open => !open)}>
        <span className="profile-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6"/></svg></span>
      </button>
      {profileOpen && <div className="profile-popover">
        <div className="profile-popover-summary">
          <span className="profile-summary-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6"/></svg></span>
          <div>{menuAccount?.me ? <><b>{menuAccount.me.isGuest ? '체험 계정' : menuAccount.me.email}</b><span>{menuAccount.me.role === 'CENTER' ? '현장실습지원센터 담당자' : menuAccount.profile ? `${menuAccount.profile.department?.name ?? '학과 정보 없음'}${menuAccount.profile.grade ? ` · ${menuAccount.profile.grade}학년` : ''}` : '학과 정보 없음'}</span></> : <><b>계정 정보</b><span>{menuAccount?.token === token ? '정보를 불러오지 못했어요' : '불러오는 중…'}</span></>}</div>
        </div>
        <Link to="/me" onClick={() => setProfileOpen(false)}><span>내 프로필</span><b>›</b></Link>
        <Link to="/me?view=saved" onClick={() => setProfileOpen(false)}><span>담은 실습</span><b>›</b></Link>
        <Link to="/plan" onClick={() => setProfileOpen(false)}><span>내 지망</span><b>›</b></Link>
        <button className="profile-popover-logout" type="button" onClick={logout}>로그아웃</button>
      </div>}
    </div> : <Link className="top-action" to="/login">로그인</Link>}
  </header>
}
