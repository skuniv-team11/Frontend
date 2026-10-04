import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Badge({ children, tone = 'gray' }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

// 팝업·정보 패널은 공통으로 진입/퇴장 모션을 거친 뒤 닫는다.
function useDismissTransition(close, duration = 280) {
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const dismiss = () => {
    if (closing) return
    setClosing(true)
    timer.current = window.setTimeout(close, duration)
  }
  return { closing, dismiss }
}

export function SidePanel({ title, children, close, className = '' }) {
  const { closing, dismiss } = useDismissTransition(close)
  return createPortal(<div className={`overlay motion-layer ${closing ? 'is-closing' : ''}`} onClick={dismiss}><aside className={`side-panel motion-surface ${className}`} onClick={event => event.stopPropagation()}><button className="close" onClick={dismiss}>×</button><h2>{title}</h2>{children}</aside></div>, document.body)
}

export function Toast({ children, className = '', ...props }) {
  return createPortal(<div className={`toast ${className}`} role="status" {...props}>{children}</div>, document.body)
}

export function Modal({ children, close, className = '' }) {
  const { closing, dismiss } = useDismissTransition(close)
  return createPortal(<div className={`modal-backdrop motion-layer ${closing ? 'is-closing' : ''}`} onClick={dismiss}><div className={`modal motion-surface ${className}`} onClick={event => event.stopPropagation()}>{typeof children === 'function' ? children(dismiss) : children}</div></div>, document.body)
}
