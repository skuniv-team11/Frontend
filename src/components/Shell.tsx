import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'

export function Shell({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return <div className="shell">
    <header className="topbar">
      <Link className="brand" to="/">현장뛰자<span>.</span></Link>
      <nav>{center ? <b>현장실습지원센터</b> : <><NavLink to="/jobs">직무 찾기</NavLink><NavLink to="/plan">내 지망</NavLink><NavLink to="/me">내 정보</NavLink></>}</nav>
      <Link className="top-action" to={center ? '/' : '/login'}>{center ? '학생 화면' : '로그인'}</Link>
    </header>{children}
  </div>
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'green' | 'orange' | 'gray' | 'blue' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function SidePanel({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  return <div className="overlay" onClick={close}><aside className="side-panel" onClick={event => event.stopPropagation()}><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</aside></div>
}

export function Modal({ children, close }: { children: ReactNode; close: () => void }) {
  return <div className="modal-backdrop" onClick={close}><div className="modal" onClick={event => event.stopPropagation()}>{children}</div></div>
}
