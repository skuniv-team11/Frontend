import { Link, useNavigate } from 'react-router-dom'
import { useGuestStart } from '../hooks/useGuestStart'
import './LoginRequired.css'

export function LoginRequired({ title = '나에게 맞는 직무를 찾아보세요', destination }) {
  const navigate = useNavigate()
  const { start, loadingRole, error } = useGuestStart((defaultDestination) => navigate(destination ?? defaultDestination))
  return <main className="jobs-login-page"><section className="jobs-login-content"><div className="jobs-login-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2" /><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M12 14v3" /></svg></div><span className="jobs-login-kicker">로그인하고</span><h1>{title}</h1><div className="jobs-login-actions"><Link className="jobs-login-button" to="/login">로그인하러 가기</Link><button type="button" className="jobs-example-button" disabled={loadingRole !== null} onClick={() => start('STUDENT')}>{loadingRole === 'STUDENT' ? '예시 프로필 준비 중…' : '예시 프로필로 시작하기'}</button></div>{error && <p className="jobs-login-error" role="alert">{error}</p>}</section></main>
}
