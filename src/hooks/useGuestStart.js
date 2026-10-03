import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { guest } from '../api/auth'

//체험 계정을 만들고 기다리는 상태랑 오류 보관함//

const guestErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.code === 'RATE_LIMITED') return '체험 계정을 너무 많이 만들었어요. 잠시 뒤 다시 시도해 주세요.'
  return '체험 계정을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

// [예시 프로필로 시작](STUDENT) · [센터 담당자로 보기](CENTER) — 체험 계정을 만들고 바로 들어간다
export function useGuestStart(onNavigate) {
  const navigate = useNavigate()
  const [loadingRole, setLoadingRole] = useState(null)
  const [error, setError] = useState('')

  const start = async (role) => {
    setLoadingRole(role); setError('')
    try {
      await guest(role)
      const destination = role === 'CENTER' ? '/center' : '/profile'
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
