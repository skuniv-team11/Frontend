import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './PlanSignalNotice.css'

export function PlanSignalNotice({ items = [], close, snooze }) {
  const [snoozed,setSnoozed]=useState(false)
  useEffect(() => {
    document.body.classList.add('has-plan-signal-notice')
    return () => document.body.classList.remove('has-plan-signal-notice')
  }, [])
  if (!items.length) return null
  return createPortal(<><div className="plan-signal-notice-backdrop" aria-hidden="true"/><div className="plan-signal-notice-shell"><aside className="plan-signal-notice" role="dialog" aria-modal="true" aria-live="polite">
      <div className="plan-signal-notice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2 21 20H3L12 3.2Z"/><path d="M12 8.3v5.2M12 17.2v.1"/></svg></div><div className="plan-signal-notice-copy">
        <p>관심이 몰리는 지망이 {items.length}개 있어요.</p>
        <div className="plan-signal-notice-items">{items.map(item => <div className="plan-signal-notice-item" key={item.jobId}><b>{item.institution?.name} · {item.title}</b></div>)}</div>
        <p className="plan-signal-notice-helper">비슷한 빈자리에서 다른 직무도 확인할 수 있어요.</p>
      </div>
      <button type="button" className="plan-signal-notice-close" aria-label="닫기" onClick={()=>snoozed?snooze():close()}>×</button>
    </aside><label className="plan-signal-notice-snooze"><input type="checkbox" checked={snoozed} onChange={event=>setSnoozed(event.target.checked)}/><span>하루 동안 보지 않기</span></label></div></>, document.body)
}
