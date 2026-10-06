import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearToken, getToken } from '../../api/client'
import { getJob } from '../../api/jobs'
import { deleteAccount, getMe, getMyProfile } from '../../api/myInfo'
import { getMyPlan } from '../../api/plan'
import { getCodes } from '../../api/reference'
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

function AccountSummary({ me, profile }) {
  if (me.loading) return <div className="me-account-copy"><b>불러오는 중…</b><span>계정 정보를 확인하고 있어요</span></div>
  if (!me.data) return <div className="me-account-copy"><b>로그인이 필요해요</b><span>계정 정보를 불러오지 못했어요</span></div>
  const user = me.data
  const department = profile.data?.department?.name
  const grade = profile.data?.grade
  const detail = user.role === 'CENTER' ? '현장실습지원센터 담당자' : profile.loading ? '프로필 불러오는 중…' : department ? `${department}${grade ? ` · ${grade}학년` : ''}` : '학과 정보 없음'
  return <div className="me-account-copy"><b>{user.email ?? '체험 계정'}</b><span>{detail}</span>{user.isGuest && user.expiresAt && <small>{formatDateTime(user.expiresAt)}까지 사용</small>}</div>
}

function SavedProfile({ profile }) {
  if (profile.loading) return <p>불러오는 중…</p>
  if (profile.error?.code === 'PROFILE_NOT_FOUND') return <p className="notice">저장한 프로필이 없어요. 프로필에서 [저장]에 동의하면 여기에 보여요.</p>
  if (profile.error) return <p className="danger">저장한 프로필을 불러오지 못했어요.</p>
  if (!profile.data) return <p className="notice">학생 계정으로 로그인하면 저장한 프로필을 볼 수 있어요.</p>
  const saved = profile.data
  return <div className="me-saved-profile" key={saved.updatedAt}>{saved.isExample && <Badge tone="blue">예시 프로필</Badge>}<dl><div><dt>학교 · 학과</dt><dd>서경대학교 · {saved.department?.name ?? '—'}</dd></div><div><dt>학년</dt><dd>{saved.grade}학년 · {saved.completedSemesters}학기 이수</dd></div><div><dt>사는 곳</dt><dd>{saved.homeArea ? `${saved.homeArea.sido} ${saved.homeArea.name}` : '선택 안 함'}</dd></div><div><dt>관심 분야</dt><dd>{saved.interestText || '선택 안 함'}</dd></div></dl></div>
}

function SavedPractice({ item, label }) {
  const loadJob=useCallback(signal=>getJob(item.jobId,signal),[item.jobId])
  const job=useRequest(loadJob)
  const conditions=job.data?.conditions
  const meta=job.loading?'실습 정보 불러오는 중…':conditions?`${label('jobType',conditions.jobType)} · ${conditions.stipend?.amount?`${label('stipendBasis',conditions.stipend.basis)} ${conditions.stipend.amount.toLocaleString('ko-KR')}원`:'급여 미기재'}`:'실습 정보 미기재'
  return <Link className="me-saved-practice" to={`/jobs/${item.jobId}`}><div>{item.rank&&<Badge tone="blue">{item.rank}지망</Badge>}<small>{item.institution.name}</small><h3>{item.title}</h3><p>{meta}</p></div><span>상세 보기</span></Link>
}

function SavedPractices({ plan, label }) {
  if (plan.loading) return <p>담은 실습을 불러오는 중…</p>
  if (plan.error?.code === 'FORBIDDEN_ROLE') return <p className="notice">담은 실습은 학생 계정에서만 볼 수 있어요.</p>
  if (plan.error) return <p className="danger">담은 실습을 불러오지 못했어요.</p>
  if (!plan.data?.items.length) return <div className="me-saved-empty"><b>아직 담은 실습이 없어요</b><span>직무 찾기에서 관심 있는 직무를 담아 보세요.</span><Link to="/jobs">직무 찾기 →</Link></div>
  return <div className="me-saved-practices">{plan.data.items.map(item=><SavedPractice item={item} label={label} key={item.jobId}/>)}</div>
}

export function MePage(){
  const [leave,setLeave]=useState(false); const navigate=useNavigate(); const location=useLocation()
  const view=new URLSearchParams(location.search).get('view')==='saved'?'saved':'profile'
  const [editing,setEditing]=useState(Boolean(location.state?.editProfile))
  const [editClosing,setEditClosing]=useState(false)
  const editTimer=useRef(null)
  useEffect(()=>()=>window.clearTimeout(editTimer.current),[])
  const me=useRequest(getMe,Boolean(getToken()))
  const profile=useRequest(getMyProfile,me.data?.role==='STUDENT')
  const plan=useRequest(getMyPlan,me.data?.role==='STUDENT')
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  const [loggingOut,setLoggingOut]=useState(false)
  const logout=async()=>{
    if(loggingOut)return
    setLoggingOut(true)
    await new Promise(resolve=>window.setTimeout(resolve,450))
    clearToken()
    window.location.replace('/')
  }
  const [leaving,setLeaving]=useState(false); const [leaveError,setLeaveError]=useState('')
  const leaveAccount=async()=>{
    setLeaving(true);setLeaveError('')
    try{await deleteAccount();navigate('/')}
    catch(caught){setLeaveError(leaveErrorMessage(caught))}
    finally{setLeaving(false)}
  }
  return <main className="me-page">
    <aside className="me-sidebar">
      <div className="me-identity"><span className="me-avatar"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19c.4-4 2.5-6 6.5-6s6.1 2 6.5 6"/></svg></span><AccountSummary me={me} profile={profile}/></div>
      <nav className="me-nav" aria-label="내 정보 메뉴">
        <button className={view==='profile'?'active':''} type="button" onClick={()=>navigate('/me')}>내 프로필</button>
        <button className={view==='saved'?'active':''} type="button" onClick={()=>{setEditing(false);navigate('/me?view=saved')}}>담은 실습</button>
      </nav>
        <button className="me-logout" disabled={!me.data||loggingOut} aria-busy={loggingOut} onClick={logout}>{loggingOut&&<span className="logout-spinner" aria-hidden="true"/>}{loggingOut?'로그아웃 중…':'로그아웃'}</button>
        {profile.data&&<Link className="me-jobs-link" to="/jobs">직무 담으러 가기 <span aria-hidden="true">→</span></Link>}
    </aside>
    <section className="me-workspace">
      <header><h1>{view==='saved'?'담은 실습':'내 프로필'}</h1></header>
      {view==='saved'?<div className="me-panel me-saved-panel" key="saved"><section className="me-panel-section"><div className="me-section-heading"><div><span>SAVED JOBS</span><h2>내가 담은 실습</h2></div><small>{plan.data?.items.length??0}개</small></div><SavedPractices plan={plan} label={label}/></section></div>:<div className={`me-panel me-stage ${editing?'is-editing':''} ${editClosing?'is-closing':''}`} key="profile">
        <div className="me-profile-view">
          <section className="me-panel-section"><div className="me-section-heading"><div><span>PROFILE</span><h2>저장된 프로필</h2></div><button className="me-edit-profile" type="button" onClick={()=>{setEditClosing(false);setEditing(true)}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/><path d="m13.8 7.2 3 3"/></svg><span>프로필 수정</span></button></div><SavedProfile profile={profile}/></section>
          <section className="me-panel-section me-account-actions"><div className="me-section-heading"><div><span>MANAGE</span><h2>계정 관리</h2></div></div><button className="danger" disabled={!me.data} onClick={()=>{setLeaveError('');setLeave(true)}}>회원 탈퇴 <span>›</span></button></section>
        </div>
        {editing&&<div className="me-profile-editor"><ProfilePage embedded onCancel={()=>{setEditClosing(true);editTimer.current=window.setTimeout(()=>{setEditing(false);setEditClosing(false);navigate('/me',{replace:true})},480)}} onSaved={(updated)=>{profile.mutate(updated);setEditing(false);navigate('/me',{replace:true})}}/></div>}
      </div>}
    </section>
    {leave&&<Modal close={()=>!leaving&&setLeave(false)}><h2>정말 탈퇴하시겠어요?</h2><p>계정과 저장된 프로필, 담은 실습과 지망을 포함한 모든 정보가 사라지며 되돌릴 수 없어요.</p>{leaveError&&<p className="notice danger" role="alert">{leaveError}</p>}<div className="button-row center"><button className="button" disabled={leaving} onClick={()=>setLeave(false)}>취소</button><button className="button danger-button" disabled={leaving} onClick={leaveAccount}>{leaving?'탈퇴하는 중…':'탈퇴하기'}</button></div></Modal>}
  </main>
}
