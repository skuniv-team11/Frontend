import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shell } from '../components/Shell'

export function LoginPage() {
  const [mode,setMode]=useState<'login'|'signup'>('login'); const navigate=useNavigate()
  return <Shell><main className="auth-page"><section className="auth-card"><h1>{mode==='login'?'로그인':'가입'}</h1><div className="tabs"><button className={mode==='login'?'active':''} onClick={()=>setMode('login')}>로그인</button><button className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>가입</button></div><label>이메일<input placeholder="student@skuniv.ac.kr" /></label><label>비밀번호<input type="password" placeholder="8자 이상" /></label>{mode==='signup'&&<label className="check"><input type="checkbox"/> 이용약관과 개인정보 처리 안내에 동의합니다.</label>}<button className="button primary full" onClick={()=>navigate(mode==='login'?'/jobs':'/profile')}>{mode==='login'?'로그인':'가입하고 시작'}</button><div className="divider">또는</div><button className="button full" onClick={()=>navigate('/profile')}>예시 프로필로 둘러보기</button></section></main></Shell>
}
