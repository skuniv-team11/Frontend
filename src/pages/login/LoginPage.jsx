import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from '../../api/auth'
import { useGuestStart } from '../../hooks/useGuestStart'
import { ProfilePage } from '../profile/ProfilePage'
import './LoginPage.css'

const authErrorMessage = (error, mode) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.code === 'LOGIN_FAILED') return '이메일 또는 비밀번호가 맞지 않아요.'
  if (error.code === 'EMAIL_TAKEN') return '이미 가입한 이메일이에요. 로그인해 주세요.'
  if (error.code === 'INVALID_INPUT' && error.fields.length) return error.fields.map(field => field.reason).join(' · ')
  return `${mode==='login'?'로그인':'가입'}하지 못했어요. 잠시 뒤 다시 시도해 주세요.`
}

export function LoginPage() {
  const [mode,setMode]=useState('login'); const navigate=useNavigate()
  const [leaving,setLeaving]=useState(false)
  const [exitStyle,setExitStyle]=useState('default')
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [passwordConfirm,setPasswordConfirm]=useState(''); const [agreed,setAgreed]=useState(false)
  const [loading,setLoading]=useState(false); const [error,setError]=useState('')
  const [authStage,setAuthStage]=useState('idle')
  const [showProfile,setShowProfile]=useState(false)
  const [panelPhase,setPanelPhase]=useState('idle'); const [slideDirection,setSlideDirection]=useState('forward')
  const panelTimer=useRef(null)
  useEffect(()=>()=>window.clearTimeout(panelTimer.current),[])
  const changeMode=(next)=>{
    if(next===mode||panelPhase!=='idle')return
    const direction=next==='signup'?'forward':'backward'
    setSlideDirection(direction);setPanelPhase('leaving');setError('')
    panelTimer.current=window.setTimeout(()=>{
      setMode(next);setPanelPhase('entering')
      panelTimer.current=window.setTimeout(()=>setPanelPhase('idle'),360)
    },220)
  }
  const leave=(destination=-1,style='default')=>{
    if(leaving)return
    setExitStyle(style);setLeaving(true)
    window.setTimeout(()=>{
      if(typeof destination==='number')navigate(destination)
      else navigate(destination,style==='onboarding'?{state:{fromSignup:true}}:undefined)
    },style==='onboarding'?620:460)
  }
  const { start: startGuest, loadingRole, error: guestError } = useGuestStart(leave)
  const openProfile=()=>{
    setAuthStage('profile-leaving')
    window.setTimeout(()=>{setShowProfile(true);setAuthStage('idle')},620)
  }

  const submit=async(event)=>{
    event.preventDefault()
    if(mode==='signup'&&password.length<8){setError('비밀번호는 8자 이상이어야 해요.');return}
    if(mode==='signup'&&password!==passwordConfirm){setError('비밀번호가 서로 같지 않아요.');return}
    if(mode==='signup'&&!agreed){setError('이용약관과 개인정보 처리 안내에 동의해 주세요.');return}
    setLoading(true);setError('')
    try{
      setAuthStage('leaving')
      await new Promise(resolve=>window.setTimeout(resolve,260))
      setAuthStage('loading')
      const request=mode==='login'?login:signup
      const data=mode==='login'?await request({email,password}):(await Promise.all([request({email,password}),new Promise(resolve=>window.setTimeout(resolve,650))]))[0]
      const needsProfile=!data.user.hasProfile
      if(needsProfile)openProfile()
      else leave('/jobs')
    }
    catch(caught){setAuthStage('idle');setError(authErrorMessage(caught,mode))}
    finally{setLoading(false)}
  }

  return <main className={`auth-page auth-scene ${leaving?'is-leaving':''} ${leaving&&exitStyle==='onboarding'?'is-onboarding-exit':''}`}>
    <section className="auth-shell" aria-label={showProfile?'프로필 입력':'로그인과 가입'}>
    {showProfile?<div className="profile-onboarding-shell"><ProfilePage embedded onSaved={()=>leave('/jobs')} /></div>:<div className={`auth-login-stage ${authStage==='profile-leaving'?'is-profile-leaving':''}`}>
      <aside className="auth-welcome">
        <div className="auth-logo">현장뛰자<span>.</span></div>
      </aside>
      <form className="auth-form" onSubmit={submit}>
        {authStage==='loading'||authStage==='success'||authStage==='profile-leaving'?<div className={`auth-signup-status is-${authStage}`} role="status">
          {authStage==='loading'||authStage==='profile-leaving'?<><span className="auth-loading-ring"/><h2 className="auth-loading-label">LOADING</h2></>:<><span className="auth-success-check">✓</span><h2>{mode==='login'?'로그인 완료':'회원가입 완료'}</h2><p>{mode==='login'?'이어서 이동할게요.':'프로필 입력 화면으로 이동할게요.'}</p></>}
        </div>:<div className={`auth-signup-form ${authStage==='leaving'?'is-leaving':''}`}>
          <div className={`tabs auth-tabs ${mode==='signup'?'is-signup':''}`}><button type="button" className={mode==='login'?'active':''} disabled={panelPhase!=='idle'} onClick={()=>changeMode('login')}>로그인</button><button type="button" className={mode==='signup'?'active':''} disabled={panelPhase!=='idle'} onClick={()=>changeMode('signup')}>회원가입</button></div>
          <div className={`auth-content is-${panelPhase} is-${slideDirection}`}>
          <div className="auth-heading"><h2>{mode==='login'?'로그인':'회원가입'}</h2></div>
          <div className="auth-tab-panel">
            <label>이메일<input type="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="student@skuniv.ac.kr" /></label>
            <label>비밀번호<input type="password" required value={password} onChange={event=>setPassword(event.target.value)} placeholder="8자 이상" /></label>
            {mode==='signup'&&<label>비밀번호 확인<input type="password" required value={passwordConfirm} onChange={event=>setPasswordConfirm(event.target.value)} placeholder="비밀번호를 한 번 더 입력해 주세요" /></label>}
            {mode==='signup'&&<label className="check"><input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}/> 이용약관과 개인정보 처리 안내에 동의합니다.</label>}
            {error&&<p className="notice danger" role="alert">{error}</p>}
            <div className="auth-action-row">
              <button className="button primary" disabled={loading||leaving}>{loading?(mode==='login'?'로그인하는 중…':'가입하는 중…'):(mode==='login'?'로그인':'가입하고 시작')}</button>
              {mode==='login'&&<button type="button" className="button auth-guest" disabled={loadingRole!==null||leaving} onClick={()=>startGuest('STUDENT')}>{loadingRole?'체험 계정 만드는 중…':'예시 프로필로 둘러보기'}</button>}
            </div>
            {guestError&&<p className="notice danger" role="alert">{guestError}</p>}
          </div>
          </div>
        </div>}
      </form>
    </div>}
    </section>
    <button type="button" className="auth-back" onClick={()=>leave()} disabled={leaving}>← 뒤로가기</button>
  </main>
}
