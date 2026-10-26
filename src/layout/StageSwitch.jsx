import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { guestStudent } from '../api/auth'
import { errorMessage } from '../api/client'
import { Modal } from '../components/Shell'
import { STAGES } from '../lib/stages'

// 체험 학생 시점 고르기 — 고르면 그 시점의 새 체험 계정을 만든다(#5 stage).
export function StageSwitch({ close, onDone }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const pick = async (stage) => {
    setBusy(stage); setError(null)
    try {
      await guestStudent(stage)
      if (onDone) onDone(stage)
      else { close(); navigate(stage === 'APPLYING' ? '/' : '/internship'); window.location.reload() }
    } catch (caught) {
      setError(caught)
      setBusy(null)
    }
  }
  return <Modal close={close} className="v2-stage-modal">
    <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>체험할 시점을 골라 주세요</h2>
    <p style={{ margin: '0 0 18px' }}>예시 프로필(메이크업디자인학과 3학년)로 새 체험 계정을 만들어요. 24시간 뒤 지워져요.</p>
    <div style={{ display: 'grid', gap: 8, textAlign: 'left' }}>
      {STAGES.map(([stage, title, sub]) => <button key={stage} type="button" className="fx-btn block" style={{ height: 'auto', padding: '12px 16px', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }} disabled={Boolean(busy)} onClick={() => pick(stage)}>
        <b>{busy === stage ? '만드는 중…' : title}</b><small style={{ color: '#7b8491', fontWeight: 600 }}>{sub}</small>
      </button>)}
    </div>
    {error && <p className="danger" role="alert" style={{ marginTop: 12 }}>{errorMessage(error)}</p>}
  </Modal>
}
