import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { guestCenter, guestStudent } from '../api/auth'

const guestErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요.'
  if (error.code === 'RATE_LIMITED') return '체험 계정을 너무 많이 만들었어요. 잠시 뒤 다시 시도해 주세요.'
  return '체험 계정을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

// [예시 프로필로 시작](STUDENT, 시점 stage) · [센터 담당자로 보기](CENTER) — 체험 계정을 만들고 바로 들어간다
export function useGuestStart(onNavigate) {
  const navigate = useNavigate()
  const [loadingRole, setLoadingRole] = useState(null)
  const [error, setError] = useState('')

  const start = async (role, stage = 'APPLYING') => {
    setLoadingRole(role); setError('')
    try {
      if (role === 'CENTER') await guestCenter()
      else await guestStudent(stage)
      const destination = role === 'CENTER' ? '/center' : stage === 'APPLYING' ? '/' : '/internship'
      if (onNavigate) onNavigate(destination)
      else navigate(destination)
    } catch (caught) {
      setError(guestErrorMessage(caught))
    } finally {
      setLoadingRole(null)
    }
  }

  return { start, loadingRole, error }
}
