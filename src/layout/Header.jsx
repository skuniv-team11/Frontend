import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

export function Header({ center = false, hidden = false }) {
  const location = useLocation()
  const [isHomeTop, setIsHomeTop] = useState(location.pathname === '/' && window.scrollY < 12)

  useEffect(() => {
    const updateTopbar = () => setIsHomeTop(location.pathname === '/' && window.scrollY < 12)
    updateTopbar()
    window.addEventListener('scroll', updateTopbar, { passive: true })
    return () => window.removeEventListener('scroll', updateTopbar)
  }, [location.pathname])

  return <header aria-hidden={hidden} className={`topbar ${isHomeTop ? 'home-topbar' : ''} ${hidden ? 'topbar-hidden' : ''}`}>
    <Link className="brand" to="/">현장뛰자<span>.</span></Link>
    <nav>{center ? <b>현장실습지원센터</b> : <><NavLink to="/" end>홈</NavLink><NavLink to="/jobs">직무 찾기</NavLink><NavLink to="/plan">내 지망</NavLink><NavLink to="/me">내 정보</NavLink></>}</nav>
    <Link className="top-action" to={center ? '/' : '/login'}>{center ? '학생 화면' : '로그인'}</Link>
  </header>
}
