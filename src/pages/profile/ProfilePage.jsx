import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getToken } from '../../api/client'
import chevronDown from '../../assets/icons/chevron-down.png'
import { getMyProfile, saveMyProfile } from '../../api/myInfo'
import { getAreas, getDepartments } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import './ProfilePage.css'

// 폼 값은 화면 상태로만 든다. 서버 저장은 [저장] + 동의 때만(AGENTS.md, 백엔드 ADR-0008).
const emptyForm = { departmentId: '', grade: null, completedSemesters: 0, gpa: '', graduationExpected: false, homeAreaCode: '' }

const toForm = (saved) => ({
  departmentId: String(saved.departmentId),
  grade: saved.grade,
  completedSemesters: saved.completedSemesters,
  gpa: String(saved.gpa),
  graduationExpected: saved.graduationExpected,
  homeAreaCode: saved.homeAreaCode ?? '',
})

const toProfile = (form) => ({
  departmentId: Number(form.departmentId),
  grade: form.grade,
  completedSemesters: form.completedSemesters,
  gpa: Number(form.gpa),
  graduationExpected: form.graduationExpected,
  interestText: null,
  homeAreaCode: form.homeAreaCode || null,
})

const validate = (form) => {
  if (!form.departmentId) return '학과를 골라 주세요.'
  if (!form.grade) return '학년을 골라 주세요.'
  if (!/^\d(\.\d)?$/.test(form.gpa) || Number(form.gpa) > 4.5) return '평점은 0.0~4.5, 소수 첫째 자리까지 적어 주세요.'
  return ''
}

const saveErrorMessage = (error) => {
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인한 뒤 저장해 주세요.'
  if (error.code === 'FORBIDDEN_ROLE') return '학생 계정만 프로필을 저장할 수 있어요.'
  if (error.code === 'CONSENT_REQUIRED') return '저장에 동의해 주세요.'
  if (error.code === 'INVALID_INPUT' && error.fields.length) return error.fields.map(field => field.reason).join(' · ')
  return '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

export function ProfilePage({ embedded = false, onSaved }) {
  const location=useLocation()
  const fromSignup=Boolean(location.state?.fromSignup)
  const loggedIn=Boolean(getToken())
  const saved=useRequest(getMyProfile,loggedIn)
  const departments=useRequest(getDepartments)
  const areas=useRequest(getAreas)

  // 사용자가 고치기 전에는 저장된 프로필을 보여 주고, 고치기 시작하면 draft를 쓴다
  const [draft,setDraft]=useState(null)
  const form=draft??(saved.data?toForm(saved.data):emptyForm)
  const change=(field,value)=>{setDraft({...form,[field]:value});setMessage(null)}

  const [consent,setConsent]=useState(false)
  const [saving,setSaving]=useState(false)
  const [message,setMessage]=useState(null)
  const [departmentPicker,setDepartmentPicker]=useState(false)
  const [departmentQuery,setDepartmentQuery]=useState('')
  const departmentListRef=useRef(null)
  const scrollbarTrackRef=useRef(null)
  const dragRef=useRef(null)
  const [scrollbar,setScrollbar]=useState({top:0,height:0,visible:false})
  const [areaPicker,setAreaPicker]=useState(false)
  const [areaQuery,setAreaQuery]=useState('')
  const areaListRef=useRef(null)
  const areaDragRef=useRef(null)
  const [areaScrollbar,setAreaScrollbar]=useState({top:0,height:0,visible:false})

  const save=async()=>{
    const invalid=validate(form)
    if(invalid){setMessage({tone:'danger',text:invalid});return}
    if(!loggedIn){setMessage({tone:'danger',text:'로그인하면 저장할 수 있어요.'});return}
    if(!consent){setMessage({tone:'danger',text:'저장하려면 동의에 체크해 주세요. 동의하지 않으면 이번 추천에만 쓰고 남기지 않아요.'});return}
    setSaving(true);setMessage(null)
    try{await saveMyProfile(toProfile(form));setMessage({tone:'',text:'프로필을 저장했어요.'});onSaved?.()}
    catch(caught){setMessage({tone:'danger',text:saveErrorMessage(caught)})}
    finally{setSaving(false)}
  }

  const status=saved.loading?'저장한 프로필을 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.':saved.data?.isExample&&!draft?'예시 프로필을 불러왔어요. 고쳐서 저장할 수 있어요.':saved.data&&!draft?'저장한 프로필을 불러왔어요.':saved.error&&saved.error.code!=='PROFILE_NOT_FOUND'?'저장한 프로필을 불러오지 못했어요.':''
  const departmentList=departments.data?.departments??[]
  const selectedDepartment=departmentList.find(department=>String(department.id)===form.departmentId)
  const filteredDepartments=departmentList.filter(department=>`${department.name} ${department.college??''}`.toLowerCase().includes(departmentQuery.trim().toLowerCase()))
  const areaList=areas.data?.areas??[]
  const selectedArea=areaList.find(area=>area.code===form.homeAreaCode)
  const filteredAreas=areaList.filter(area=>`${area.sido} ${area.name}`.toLowerCase().includes(areaQuery.trim().toLowerCase()))
  const updateDepartmentScrollbar=()=>{
    const list=departmentListRef.current
    if(!list)return
    const visible=list.scrollHeight>list.clientHeight
    const height=visible?Math.max(34,list.clientHeight*(list.clientHeight/list.scrollHeight)):0
    const travel=list.clientHeight-height
    const top=visible&&list.scrollHeight>list.clientHeight?(list.scrollTop/(list.scrollHeight-list.clientHeight))*travel:0
    setScrollbar({top,height,visible})
  }
  useEffect(()=>{
    if(!departmentPicker)return undefined
    const frame=window.requestAnimationFrame(updateDepartmentScrollbar)
    const observer=new ResizeObserver(updateDepartmentScrollbar)
    if(departmentListRef.current)observer.observe(departmentListRef.current)
    return()=>{window.cancelAnimationFrame(frame);observer.disconnect()}
  },[departmentPicker,filteredDepartments.length])
  const startScrollbarDrag=(event)=>{
    const list=departmentListRef.current
    if(!list)return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current={startY:event.clientY,startScroll:list.scrollTop}
  }
  const moveScrollbarDrag=(event)=>{
    const list=departmentListRef.current
    if(!list||!dragRef.current)return
    const travel=list.clientHeight-scrollbar.height
    const scrollTravel=list.scrollHeight-list.clientHeight
    if(travel>0)list.scrollTop=dragRef.current.startScroll+(event.clientY-dragRef.current.startY)*(scrollTravel/travel)
  }
  const stopScrollbarDrag=()=>{dragRef.current=null}
  const updateAreaScrollbar=()=>{
    const list=areaListRef.current
    if(!list)return
    const visible=list.scrollHeight>list.clientHeight
    const height=visible?Math.max(34,list.clientHeight*(list.clientHeight/list.scrollHeight)):0
    const travel=list.clientHeight-height
    const top=visible&&list.scrollHeight>list.clientHeight?(list.scrollTop/(list.scrollHeight-list.clientHeight))*travel:0
    setAreaScrollbar({top,height,visible})
  }
  useEffect(()=>{
    if(!areaPicker)return undefined
    const frame=window.requestAnimationFrame(updateAreaScrollbar)
    const observer=new ResizeObserver(updateAreaScrollbar)
    if(areaListRef.current)observer.observe(areaListRef.current)
    return()=>{window.cancelAnimationFrame(frame);observer.disconnect()}
  },[areaPicker,filteredAreas.length])
  const startAreaScrollbarDrag=(event)=>{
    const list=areaListRef.current
    if(!list)return
    event.currentTarget.setPointerCapture(event.pointerId)
    areaDragRef.current={startY:event.clientY,startScroll:list.scrollTop}
  }
  const moveAreaScrollbarDrag=(event)=>{
    const list=areaListRef.current
    if(!list||!areaDragRef.current)return
    const travel=list.clientHeight-areaScrollbar.height
    const scrollTravel=list.scrollHeight-list.clientHeight
    if(travel>0)list.scrollTop=areaDragRef.current.startScroll+(event.clientY-areaDragRef.current.startY)*(scrollTravel/travel)
  }
  const stopAreaScrollbarDrag=()=>{areaDragRef.current=null}

  const Container=embedded?'div':'main'
  return <Container className={`content profile-content ${fromSignup?'from-signup':''} ${embedded?'embedded-profile':''}`}><section><h1 className="profile-title">내 프로필</h1><div className="card form-card">{status&&<p className="notice" role="status">{status}</p>}<div className="form-grid">
    <label>학교<input value="서경대학교" readOnly/></label>
    <label>학년<div className="segments">{[1,2,3,4].map(grade=><button type="button" key={grade} className={form.grade===grade?'selected':''} onClick={()=>change('grade',grade)}>{grade}학년</button>)}</div></label>
    <label>학과<button type="button" className="profile-select-trigger" disabled={departments.loading||departments.error} onClick={()=>{setDepartmentQuery('');setDepartmentPicker(true)}}><span>{departments.loading?'불러오는 중…':departments.error?'학과 목록을 불러오지 못했어요':selectedDepartment?.name??'학과를 골라 주세요'}</span><img src={chevronDown} alt=""/></button></label>
    <label>이수 학기<div className="counter"><button type="button" disabled={form.completedSemesters<=0} onClick={()=>change('completedSemesters',form.completedSemesters-1)}>−</button><b>{form.completedSemesters}</b><button type="button" disabled={form.completedSemesters>=8} onClick={()=>change('completedSemesters',form.completedSemesters+1)}>＋</button></div></label>
    <label>사는 곳<button type="button" className="profile-select-trigger" disabled={areas.loading||areas.error} onClick={()=>{setAreaQuery('');setAreaPicker(true)}}><span>{areas.loading?'불러오는 중…':areas.error?'지역 목록을 불러오지 못했어요':selectedArea?`${selectedArea.sido} ${selectedArea.name}`:'선택 안 함(서경대에서 출발로 계산)'}</span><img src={chevronDown} alt=""/></button></label>
    <label>평점<input inputMode="decimal" value={form.gpa} onChange={event=>change('gpa',event.target.value)} placeholder="예: 3.4 (4.5 만점)"/></label>
  </div><label className="check"><input type="checkbox" checked={consent} onChange={event=>{setConsent(event.target.checked);setMessage(null)}}/> 이 프로필을 다음 방문에도 사용할 수 있도록 저장합니다.</label>{message&&<p className={`notice ${message.tone}`} role={message.tone?'alert':'status'}>{message.text}</p>}<button type="button" className="profile-next" disabled={saving} onClick={save}>{saving?'저장하는 중…':'다음'}<span aria-hidden="true">→</span></button></div></section>{departmentPicker&&<Modal className="profile-department-modal" close={()=>setDepartmentPicker(false)}>{dismiss=><><div className="department-modal-heading"><div><span>전공 선택</span><h2>학과를 골라 주세요</h2></div><button type="button" onClick={dismiss} aria-label="닫기">×</button></div><div className="department-search"><span aria-hidden="true">⌕</span><input autoFocus value={departmentQuery} onChange={event=>setDepartmentQuery(event.target.value)} placeholder="학과 이름으로 검색"/></div><div className="department-scroll-shell"><div ref={departmentListRef} className="department-list" role="listbox" aria-label="학과 목록" onScroll={updateDepartmentScrollbar}>{filteredDepartments.length?filteredDepartments.map(department=><button type="button" role="option" aria-selected={String(department.id)===form.departmentId} className={String(department.id)===form.departmentId?'selected':''} key={department.id} onClick={()=>{change('departmentId',String(department.id));dismiss()}}><span>{department.name}</span>{department.college&&<small>{department.college}</small>}</button>):<p>검색 결과가 없어요.</p>}</div><div ref={scrollbarTrackRef} className={`department-scrollbar ${scrollbar.visible?'is-visible':''}`} aria-hidden="true"><span style={{height:scrollbar.height,transform:`translateY(${scrollbar.top}px)`}} onPointerDown={startScrollbarDrag} onPointerMove={moveScrollbarDrag} onPointerUp={stopScrollbarDrag} onPointerCancel={stopScrollbarDrag}/></div></div></>}</Modal>}{areaPicker&&<Modal className="profile-department-modal" close={()=>setAreaPicker(false)}>{dismiss=><><div className="department-modal-heading"><div><span>출발지 선택</span><h2>사는 곳을 골라 주세요</h2></div><button type="button" onClick={dismiss} aria-label="닫기">×</button></div><div className="department-search"><span aria-hidden="true">⌕</span><input autoFocus value={areaQuery} onChange={event=>setAreaQuery(event.target.value)} placeholder="시·군·구 이름으로 검색"/></div><div className="department-scroll-shell"><div ref={areaListRef} className="department-list" role="listbox" aria-label="지역 목록" onScroll={updateAreaScrollbar}><button type="button" role="option" aria-selected={!form.homeAreaCode} onClick={()=>{change('homeAreaCode','');dismiss()}}><span>선택 안 함 · 서경대학교에서 출발</span></button>{filteredAreas.length?filteredAreas.map(area=><button type="button" role="option" aria-selected={area.code===form.homeAreaCode} key={area.code} onClick={()=>{change('homeAreaCode',area.code);dismiss()}}><span>{area.sido} {area.name}</span></button>):<p>검색 결과가 없어요.</p>}</div><div className={`department-scrollbar ${areaScrollbar.visible?'is-visible':''}`} aria-hidden="true"><span style={{height:areaScrollbar.height,transform:`translateY(${areaScrollbar.top}px)`}} onPointerDown={startAreaScrollbarDrag} onPointerMove={moveAreaScrollbarDrag} onPointerUp={stopAreaScrollbarDrag} onPointerCancel={stopAreaScrollbarDrag}/></div></div></>}</Modal>}</Container>
}
