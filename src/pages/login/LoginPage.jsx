import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from '../../api/auth'
import { useGuestStart } from '../../hooks/useGuestStart'

const authErrorMessage = (error, mode) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.code === 'LOGIN_FAILED') return '이메일 또는 비밀번호가 맞지 않아요.'
  if (error.code === 'EMAIL_TAKEN') return '이미 가입한 이메일이에요. 로그인해 주세요.'
  if (error.code === 'INVALID_INPUT' && error.fields.length) return error.fields.map(field => field.reason).join(' · ')
  return `${mode==='login'?'로그인':'가입'}하지 못했어요. 잠시 뒤 다시 시도해 주세요.`
}

export function LoginPage() {
  const [mode,setMode]=useState('login'); const navigate=useNavigate()
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [agreed,setAgreed]=useState(false)
  const [loading,setLoading]=useState(false); const [error,setError]=useState('')
  const { start: startGuest, loadingRole, error: guestError } = useGuestStart()
  const changeMode=(next)=>{setMode(next);setError('')}

  const submit=async(event)=>{
    event.preventDefault()
    if(mode==='signup'&&password.length<8){setError('비밀번호는 8자 이상이어야 해요.');return}
    if(mode==='signup'&&!agreed){setError('이용약관과 개인정보 처리 안내에 동의해 주세요.');return}
    setLoading(true);setError('')
    try{const data=await (mode==='login'?login:signup)({email,password});navigate(data.user.hasProfile?'/jobs':'/profile')}
    catch(caught){setError(authErrorMessage(caught,mode))}
    finally{setLoading(false)}
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><h1>{mode==='login'?'로그인':'가입'}</h1><div className="tabs"><button type="button" className={mode==='login'?'active':''} onClick={()=>changeMode('login')}>로그인</button><button type="button" className={mode==='signup'?'active':''} onClick={()=>changeMode('signup')}>가입</button></div><label>이메일<input type="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="student@skuniv.ac.kr" /></label><label>비밀번호<input type="password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="8자 이상" /></label>{mode==='signup'&&<label className="check"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/> 이용약관과 개인정보 처리 안내에 동의합니다.</label>}{error&&<p className="notice danger" role="alert">{error}</p>}{loading&&<p className="notice">서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>}<button className="button primary full" disabled={loading}>{loading?(mode==='login'?'로그인하는 중…':'가입하는 중…'):(mode==='login'?'로그인':'가입하고 시작')}</button><div className="divider">또는</div><button type="button" className="button full" disabled={loadingRole!==null} onClick={()=>startGuest('STUDENT')}>{loadingRole?'체험 계정 만드는 중…':'예시 프로필로 둘러보기'}</button>{guestError&&<p className="notice danger" role="alert">{guestError}</p>}</form></main>
}
