import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { deleteCareerReport } from '../../api/career'
import { clearToken, errorMessage, getToken } from '../../api/client'
import { deleteMyExplore } from '../../api/explore'
import { deleteAccount, deleteMyProfile, getMe, getMyProfile } from '../../api/me'
import { getCertificates } from '../../api/reference'
import { Badge, Modal } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import { ProfilePage } from '../profile/ProfilePage'
import './MePage.css'

const leaveErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인한 뒤 탈퇴해 주세요.'
  return '탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

const formatDateTime = (value) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// 지우기(되돌릴 수 없음) — 프로필만(#10) · 탐색 결과(#31) · 커리어 리포트(#36) · 탈퇴(#7)
const ACTIONS = {
  profile: { label: '저장한 프로필만 삭제', title: '저장한 프로필을 지울까요?', body: '학과 · 학년 · 평점 · 사는 곳 · 자격증 · 관심 분야가 지워져요. 계정과 담은 직무 · 지원서는 남아요. 프로필이 없으면 판정 · 직무 탐색을 하려면 다시 입력해야 해요.', run: deleteMyProfile, done: '저장한 프로필을 지웠어요.', button: '프로필 지우기' },
  explore: { label: '직무 탐색 결과 지우기', title: '직무 탐색 결과를 지울까요?', body: '저장된 탐색 결과와 경험 글, \'왜 맞나요\'가 함께 지워져요. 담은 직무는 남아요.', run: deleteMyExplore, done: '직무 탐색 결과를 지웠어요.', button: '탐색 결과 지우기' },
  career: { label: '커리어 리포트 지우기', title: '커리어 리포트를 지울까요?', body: '리포트와 붙여 넣은 실습 내용이 함께 지워져요. 수행결과보고서 냄 표시는 리포트가 있어야 해요.', run: deleteCareerReport, done: '커리어 리포트를 지웠어요.', button: '리포트 지우기' },
  leave: { label: '회원 탈퇴', title: '정말 탈퇴하시겠어요?', body: '계정과 저장된 프로필, 담은 직무와 지망, 직무 탐색 결과, 커리어 리포트, 지원서가 모두 바로 지워지며 되돌릴 수 없어요.', run: deleteAccount, button: '탈퇴하기' },
}

function AccountSummary({ me, profile }) {
  if (me.loading) return <div className="me-account-copy"><b>불러오는 중…</b><span>계정 정보를 확인하고 있어요</span></div>
  if (!me.data) return <div className="me-account-copy"><b>로그인이 필요해요</b><span>계정 정보를 불러오지 못했어요</span></div>
  const user = me.data
  const department = profile.data?.department?.name
  const grade = profile.data?.grade
  const detail = user.role === 'CENTER' ? '현장실습지원센터 담당자' : profile.loading ? '프로필 불러오는 중…' : department ? `${department}${grade ? ` · ${grade}학년` : ''}` : '학과 정보 없음'
  return <div className="me-account-copy"><b>{user.email ?? '체험 계정'}</b><span>{detail}</span>{user.isGuest && user.expiresAt && <small>{formatDateTime(user.expiresAt)}까지 사용</small>}</div>
}

function SavedProfile({ profile, certificates }) {
  if (profile.loading) return <p className="me-muted">불러오는 중…</p>
  if (profile.error?.code === 'PROFILE_NOT_FOUND') return <p className="me-muted">저장한 프로필이 없어요. [프로필 수정]에서 저장에 동의하면 여기에 보여요.</p>
  if (profile.error?.code === 'FORBIDDEN_ROLE') return <p className="me-muted">센터 담당자 계정은 프로필이 없어요.</p>
  if (profile.error) return <p className="danger">저장한 프로필을 불러오지 못했어요.</p>
  if (!profile.data) return <p className="me-muted">저장한 프로필이 없어요.</p>
  const saved = profile.data
  const graduationStatus = saved.graduationExpected ? '졸업 예정' : '졸업 예정 아님'
  const certLabel = (code) => certificates.data?.certificates?.find((c) => c.code === code)?.label ?? code
  const certText = saved.certificates?.length ? saved.certificates.map(certLabel).join(' · ') : '없음'
  return <div className="me-saved-profile" key={saved.updatedAt}>{saved.isExample && <Badge tone="blue">예시 프로필</Badge>}<dl><div><dt>학교 · 학과</dt><dd>서경대학교 · {saved.department?.name ?? '—'}</dd></div><div><dt>학년</dt><dd>{saved.grade}학년 · {saved.completedSemesters}학기 이수 · 평점 {saved.gpa} · {graduationStatus}</dd></div><div><dt>사는 곳</dt><dd>{saved.homeArea ? `${saved.homeArea.sido} ${saved.homeArea.name}` : '선택 안 함'}</dd></div><div><dt>자격증</dt><dd>{certText}</dd></div><div><dt>관심 분야</dt><dd>{saved.interestText || '선택 안 함'}</dd></div></dl></div>
}

export function MePage(){
  const navigate=useNavigate(); const location=useLocation()
  const [editing,setEditing]=useState(Boolean(location.state?.editProfile))
  const [editClosing,setEditClosing]=useState(false)
  const editTimer=useRef(null)
  useEffect(()=>()=>window.clearTimeout(editTimer.current),[])
  const me=useRequest(getMe,Boolean(getToken()))
  const isStudent=me.data?.role==='STUDENT'
  const profile=useRequest(getMyProfile,isStudent)
  const certificates=useRequest(getCertificates,isStudent)
  const [loggingOut,setLoggingOut]=useState(false)
  const logout=async()=>{
    if(loggingOut)return
    setLoggingOut(true)
    await new Promise(resolve=>window.setTimeout(resolve,450))
    clearToken()
    window.location.replace('/')
  }
  const [action,setAction]=useState(null)
  const [running,setRunning]=useState(false); const [actionError,setActionError]=useState('')
  const [done,setDone]=useState(null)
  useEffect(()=>{
    if(!done)return undefined
    const timer=window.setTimeout(()=>setDone(null),3000)
    return()=>window.clearTimeout(timer)
  },[done])
  const runAction=async()=>{
    const spec=ACTIONS[action]
    setRunning(true);setActionError('')
    try{
      await spec.run()
      if(action==='leave'){navigate('/');return}
      if(action==='profile')profile.reload()
      setAction(null);setDone({text:spec.done,at:Date.now()})
    }
    catch(caught){setActionError(action==='leave'?leaveErrorMessage(caught):errorMessage(caught,'지우지 못했어요. 잠시 뒤 다시 시도해 주세요.'))}
    finally{setRunning(false)}
  }
  // 옛 '담은 실습'(/me?view=saved)은 내 현장실습의 지망 정하기로 옮겼다
  if(new URLSearchParams(location.search).get('view')==='saved')return <Navigate to="/internship" replace/>
  const spec=action&&ACTIONS[action]
  return <main className="me-page">
    <aside className="me-sidebar">
      <div className="me-identity"><span className="me-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6"/></svg></span><AccountSummary me={me} profile={profile}/></div>
      <nav className="me-nav" aria-label="내 정보 메뉴">
        <button className="active" type="button" onClick={()=>navigate('/me')}>내 프로필</button>
        {isStudent&&<Link to="/internship">내 현장실습 · 담은 직무</Link>}
        {isStudent&&<Link to="/career">커리어 리포트</Link>}
      </nav>
        <button className="me-logout" disabled={!me.data||loggingOut} aria-busy={loggingOut} onClick={logout}>{loggingOut&&<span className="logout-spinner" aria-hidden="true"/>}{loggingOut?'로그아웃 중…':'로그아웃'}</button>
        {profile.data&&<Link className="me-jobs-link" to="/jobs">직무 담으러 가기 <span aria-hidden="true">→</span></Link>}
    </aside>
    <section className="me-workspace">
      <header><h1>내 프로필</h1></header>
      <div className={`me-panel me-stage ${editing?'is-editing':''} ${editClosing?'is-closing':''}`} key="profile">
        <div className="me-profile-view">
          <section className="me-panel-section"><div className="me-section-heading"><div><span>PROFILE</span><h2>저장된 프로필</h2></div>{isStudent&&<button className="me-edit-profile" type="button" onClick={()=>{setEditClosing(false);setEditing(true)}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.2 3 3"/></svg><span>프로필 수정</span></button>}</div>{me.data&&!isStudent?<p className="me-muted">센터 담당자 계정은 프로필이 없어요.</p>:<SavedProfile profile={profile} certificates={certificates}/>}</section>
          <section className="me-panel-section me-account-actions"><div className="me-section-heading"><div><span>MANAGE</span><h2>계정 관리</h2></div></div>
            {isStudent&&['profile','explore','career'].map(key=><button key={key} type="button" disabled={key==='profile'&&!profile.data} onClick={()=>{setActionError('');setAction(key)}}>{ACTIONS[key].label} <span>›</span></button>)}
            <button className="danger" disabled={!me.data} onClick={()=>{setActionError('');setAction('leave')}}>회원 탈퇴 <span>›</span></button>
          </section>
        </div>
        {editing&&<div className="me-profile-editor"><ProfilePage embedded onCancel={()=>{setEditClosing(true);editTimer.current=window.setTimeout(()=>{setEditing(false);setEditClosing(false);navigate('/me',{replace:true})},480)}} onSaved={(updated)=>{profile.mutate(updated);setEditing(false);navigate('/me',{replace:true})}}/></div>}
      </div>
    </section>
    {done&&<p key={done.at} className="notice" role="status">{done.text}</p>}
    {spec&&<Modal close={()=>!running&&setAction(null)}><h2>{spec.title}</h2><p>{spec.body}</p>{actionError&&<p className="danger" role="alert">{actionError}</p>}<div className="button-row center"><button className="button" disabled={running} onClick={()=>setAction(null)}>취소</button><button className="button danger-button" disabled={running} onClick={runAction}>{running?'지우는 중…':spec.button}</button></div></Modal>}
  </main>
}
