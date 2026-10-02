import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearToken, getToken } from '../../api/client'
import { deleteAccount, deleteMyProfile, getMe, getMyProfile } from '../../api/myInfo'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { Badge, Modal } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'

const deleteErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인해 주세요.'
  if (error.code === 'FORBIDDEN_ROLE') return '학생 계정만 프로필을 지울 수 있어요.'
  return '프로필을 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

const leaveErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인한 뒤 탈퇴해 주세요.'
  return '탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

const formatDateTime = (value) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function AccountInfo({ me }) {
  if (me.loading) return <p>불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>
  if (me.error?.status === 401) return <p>로그인 정보가 없거나 만료됐어요. <Link className="link-button" to="/login">다시 로그인하기 →</Link></p>
  if (me.error) return <p className="danger">로그인 정보를 불러오지 못했어요.</p>
  if (!me.data) return <p>로그인하지 않았어요. <Link className="link-button" to="/login">로그인하기 →</Link></p>
  const user = me.data
  return <><p>{user.isGuest ? '체험 계정' : user.email}{user.role === 'CENTER' && ' · 센터 담당자'}</p>{user.isGuest && user.expiresAt && <p className="notice">체험 계정은 {formatDateTime(user.expiresAt)}에 계정째 지워져요.</p>}</>
}

function SavedProfile({ profile }) {
  if (profile.loading) return <p>불러오는 중…</p>
  if (profile.error?.code === 'PROFILE_NOT_FOUND') return <p className="notice">저장한 프로필이 없어요. 프로필에서 [저장]에 동의하면 여기에 보여요.</p>
  if (profile.error) return <p className="danger">저장한 프로필을 불러오지 못했어요.</p>
  if (!profile.data) return <p className="notice">학생 계정으로 로그인하면 저장한 프로필을 볼 수 있어요.</p>
  const saved = profile.data
  return <>{saved.isExample && <Badge tone="blue">예시 프로필</Badge>}<dl><div><dt>학교 · 학과</dt><dd>서경대학교 · {saved.department?.name ?? '—'}</dd></div><div><dt>학년</dt><dd>{saved.grade}학년 · {saved.completedSemesters}학기 이수</dd></div><div><dt>사는 곳</dt><dd>{saved.homeArea ? `${saved.homeArea.sido} ${saved.homeArea.name}` : '선택 안 함'}</dd></div></dl></>
}

export function MePage(){
  const [leave,setLeave]=useState(false); const navigate=useNavigate()
  const me=useRequest(getMe,Boolean(getToken()))
  const profile=useRequest(getMyProfile,me.data?.role==='STUDENT')
  const logout=()=>{clearToken();navigate('/')}
  const [confirmDelete,setConfirmDelete]=useState(false); const [deleting,setDeleting]=useState(false); const [deleteMessage,setDeleteMessage]=useState(null)
  const canDelete=Boolean(profile.data)
  const [leaving,setLeaving]=useState(false); const [leaveError,setLeaveError]=useState('')
  const leaveAccount=async()=>{
    setLeaving(true);setLeaveError('')
    try{await deleteAccount();navigate('/')}
    catch(caught){setLeaveError(leaveErrorMessage(caught))}
    finally{setLeaving(false)}
  }
  const removeProfile=async()=>{
    setDeleting(true);setDeleteMessage(null)
    try{await deleteMyProfile();setConfirmDelete(false);setDeleteMessage({tone:'',text:'저장한 프로필을 지웠어요.'});profile.reload()}
    catch(caught){setConfirmDelete(false);setDeleteMessage({tone:'danger',text:deleteErrorMessage(caught)})}
    finally{setDeleting(false)}
  }
  return <main className="content two-column"><section><PageTitle eyebrow="계정과 저장 정보를 관리해요" title="내 정보"/><div className="card info-card"><h2>저장된 프로필</h2><SavedProfile profile={profile}/><Link className="link-button" to="/profile">프로필 수정하기 →</Link></div><div className="card account-card"><h2>계정 관리</h2><button disabled={!canDelete} onClick={()=>setConfirmDelete(true)}>저장한 프로필 삭제</button>{deleteMessage&&<p className={`notice ${deleteMessage.tone}`} role={deleteMessage.tone?'alert':'status'}>{deleteMessage.text}</p>}<button className="danger" disabled={!me.data} onClick={()=>{setLeaveError('');setLeave(true)}}>회원 탈퇴</button></div></section><ActionCard action={<button className="button full" onClick={logout}>로그아웃</button>}><h3>로그인 정보</h3><AccountInfo me={me}/></ActionCard>{confirmDelete&&<Modal close={()=>!deleting&&setConfirmDelete(false)}><h2>저장한 프로필을 지울까요?</h2><p>학과·학년·평점·사는 곳이 서버에서 지워져요. 계정과 담은 지망은 그대로 남아요.</p><div className="button-row center"><button className="button" disabled={deleting} onClick={()=>setConfirmDelete(false)}>취소</button><button className="button danger-button" disabled={deleting} onClick={removeProfile}>{deleting?'지우는 중…':'지우기'}</button></div></Modal>}{leave&&<Modal close={()=>!leaving&&setLeave(false)}><h2>정말 탈퇴할까요?</h2><p>계정과 저장한 프로필, 담은 지망이 바로 삭제되며 되돌릴 수 없어요.</p>{leaveError&&<p className="notice danger" role="alert">{leaveError}</p>}<div className="button-row center"><button className="button" disabled={leaving} onClick={()=>setLeave(false)}>취소</button><button className="button danger-button" disabled={leaving} onClick={leaveAccount}>{leaving?'탈퇴하는 중…':'탈퇴하기'}</button></div></Modal>}</main>
}
