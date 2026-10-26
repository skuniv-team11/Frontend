import { useCallback } from 'react'
import { getDemoSession, getToken } from '../api/client'
import { getMe } from '../api/me'
import { getCodes } from '../api/reference'
import { useRequest } from './useRequest'

const loadCodes = (signal) => getCodes(signal)

// 코드 표기표(#2). 한 번만 받아 모든 화면이 같이 쓴다.
export function useCodes() {
  return useRequest(loadCodes).data
}

// 지금 로그인한 계정(#6). 토큰이 없으면 부르지 않는다. { me, loading, error, loggedIn, isStudent, isCenter, demo }
export function useSession() {
  const token = getToken()
  const load = useCallback((signal) => getMe(signal), [token]) // eslint-disable-line react-hooks/exhaustive-deps
  const state = useRequest(load, Boolean(token))
  const me = state.data
  return {
    ...state,
    me,
    loggedIn: Boolean(token),
    isStudent: me?.role === 'STUDENT',
    isCenter: me?.role === 'CENTER',
    demo: getDemoSession(),
  }
}
