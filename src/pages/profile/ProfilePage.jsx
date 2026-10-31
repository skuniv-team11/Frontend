import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getToken } from '../../api/client'
import chevronDown from '../../assets/icons/chevron-down.png'
import { getMyProfile, saveMyProfile } from '../../api/me'
import { getAreas, getCertificates, getCurrentRound, getDepartments } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import { getInterestOptions } from './interestOptions'
import './ProfilePage.css'

// 폼 값은 화면 상태로만 든다. 서버 저장은 [저장] + 동의 때만(AGENTS.md, 백엔드 ADR-0008).
const emptyForm = { departmentId: '', grade: null, completedSemesters: 0, gpa: '', graduationExpected: true, interestText: '', homeAreaCode: '', certificates: [] }
// 졸업 예정 = 이번 회차 학년도의 다음 해 2월(2026-2 → 2027년 2월). 회차를 못 받았으면 오늘 기준(1·2월은 그해 2월)
const graduationYearOf = (round) => {
  const year = Number(String(round?.termCode ?? '').slice(0, 4))
  if (year) return year + 1
  const now = new Date()
  return now.getMonth() < 2 ? now.getFullYear() : now.getFullYear() + 1
}
const interestRowSizes = [4, 4, 5, 5, 2]
const interestRowStarts = [0, 4, 8, 13, 18]

const toForm = (saved) => ({
  departmentId: String(saved.departmentId),
  grade: saved.grade,
  completedSemesters: saved.completedSemesters,
  gpa: String(saved.gpa),
  graduationExpected: saved.graduationExpected,
  interestText: saved.interestText ?? '',
  homeAreaCode: saved.homeAreaCode ?? '',
  certificates: saved.certificates ?? [],
})

const toProfile = (form) => ({
  departmentId: Number(form.departmentId),
  grade: form.grade,
  completedSemesters: form.completedSemesters,
  gpa: Number(form.gpa),
  graduationExpected: form.graduationExpected,
  interestText: form.interestText.trim() || null,
  homeAreaCode: form.homeAreaCode || null,
  // 자격증은 묻고 나서 항상 목록으로 보낸다. 하나도 안 골랐으면 [](없음) — 필수 자격증 직무는 지원 불가로 보인다(#26)
  certificates: form.certificates ?? [],
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

export function ProfilePage({ embedded = false, onSaved, onCancel }) {
  const location=useLocation()
  const fromSignup=Boolean(location.state?.fromSignup)
  const loggedIn=Boolean(getToken())
  const saved=useRequest(getMyProfile,loggedIn)
  const departments=useRequest(getDepartments)
  const areas=useRequest(getAreas)
  const certificates=useRequest(getCertificates)
  const round=useRequest(getCurrentRound)
  const expectedGraduationYear=graduationYearOf(round.data)

  // 사용자가 고치기 전에는 저장된 프로필을 보여 주고, 고치기 시작하면 draft를 쓴다
  const [draft,setDraft]=useState(null)
  const form=draft??(saved.data?toForm(saved.data):emptyForm)
  const change=(field,value)=>{setDraft({...form,[field]:value});setMessage(null)}

  // 저장 동의(백엔드 ADR-0008). [저장]이 있는 마지막 단계(관심 분야)에 둔다. 저장한 프로필을 고칠 때(onCancel)는 이미 동의한 것으로 시작
  const [consent,setConsent]=useState(Boolean(onCancel))
  const [consentMissing,setConsentMissing]=useState(false)
  const [step,setStep]=useState('profile')
  const [stepDirection,setStepDirection]=useState('forward')
  const [saving,setSaving]=useState(false)
  const [saveStage,setSaveStage]=useState('idle')
  const [message,setMessage]=useState(null)
  useEffect(()=>{
    if(!message)return undefined
    const timer=window.setTimeout(()=>setMessage(null),3000)
    return()=>window.clearTimeout(timer)
  },[message])
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

  const goToLocation=()=>{
    const invalid=validate(form)
    if(invalid){setMessage({tone:'danger',text:invalid});return}
    setStepDirection('forward');setStep('location')
  }
  const goToCertificates=()=>{setStepDirection('forward');setStep('certificates')}
  const goToInterests=()=>{setStepDirection('forward');setStep('interests')}
  const goToCertificatesBack=()=>{setStepDirection('backward');setStep('certificates')}
  const goToProfile=()=>{setStepDirection('backward');setStep('profile')}
  const goToLocationBack=()=>{setStepDirection('backward');setStep('location')}
  const save=async()=>{
    if(!loggedIn){setMessage({tone:'danger',text:'로그인하면 저장할 수 있어요.'});return}
    if(!consent){setConsentMissing(true);setMessage(null);return}
    setSaving(true);setSaveStage('loading');setMessage(null)
    try{const [updated]=await Promise.all([saveMyProfile(toProfile(form)),new Promise(resolve=>window.setTimeout(resolve,450))]);setSaveStage('success');await new Promise(resolve=>window.setTimeout(resolve,950));onSaved?.(updated)}
    catch(caught){setSaveStage('idle');setMessage({tone:'danger',text:saveErrorMessage(caught)})}
    finally{setSaving(false)}
  }

  const departmentList=departments.data?.departments??[]
  const selectedDepartment=departmentList.find(department=>String(department.id)===form.departmentId)
  const interestOptions=getInterestOptions(selectedDepartment?.name)
  const interestRows=interestRowSizes.map((size,index)=>interestOptions.slice(interestRowStarts[index],interestRowStarts[index]+size))
  // 관심 분야 글 = 칩에 없는 직접 적은 말 + 고른 칩. 칩을 눌러도 직접 적은 말(예: 예시 프로필의 '뷰티 브랜드 SNS 마케팅')은 남긴다
  const interestParts=form.interestText?form.interestText.split(',').map(item=>item.trim()).filter(Boolean):[]
  const selectedInterests=interestParts.filter(item=>interestOptions.includes(item))
  const customInterests=interestParts.filter(item=>!interestOptions.includes(item))
  const toggleInterest=(interest)=>{
    const next=selectedInterests.includes(interest)?selectedInterests.filter(item=>item!==interest):selectedInterests.length<5?[...selectedInterests,interest]:selectedInterests
    if(next===selectedInterests){setMessage({tone:'danger',text:'관심 분야는 최대 5개까지 선택할 수 있어요.'});return}
    change('interestText',[...customInterests,...next].join(', '))
  }
  const removeCustomInterest=(text)=>change('interestText',[...customInterests.filter(item=>item!==text),...selectedInterests].join(', '))
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
  // 안내(검사 오류 · 저장 실패 · 5개 넘음)는 버튼 줄 바로 위에 — 제목을 가리지 않게
  const notice=message&&<p className={`profile-inline-message ${message.tone??''}`} role={message.tone?'alert':'status'}>{message.text}</p>
  return <Container className={`content profile-content ${fromSignup?'from-signup':''} ${embedded?'embedded-profile':''}`}><section>{saveStage!=='idle'?<div className={`profile-save-status is-${saveStage}`} role="status">{saveStage==='loading'?<><span className="profile-save-spinner"/><h2>프로필을 저장하고 있어요</h2><p>새 정보를 안전하게 반영하는 중이에요.</p></>:<><span className="profile-save-check">✓</span><h2>저장 완료</h2><p>새 프로필 정보를 반영했어요.</p></>}</div>:<div key={step} className={`profile-step is-${stepDirection}`}>
    {step==='profile'?<>{!onCancel&&<h1 className="profile-title">내 프로필</h1>}{onCancel&&<p className="profile-form-caption">내 정보 <span>ABOUT ME</span></p>}<div className="card form-card"><div className="form-grid">
      <label>학교<input value="서경대학교" readOnly/></label>
      <label>학년<div className="segments">{[1,2,3,4].map(grade=><button type="button" key={grade} className={form.grade===grade?'selected':''} onClick={()=>change('grade',grade)}>{grade}학년</button>)}</div></label>
      <label>학과<button type="button" className="profile-select-trigger" disabled={departments.loading||departments.error} onClick={()=>{setDepartmentQuery('');setDepartmentPicker(true)}}><span>{departments.loading?'불러오는 중…':departments.error?'학과 목록을 불러오지 못했어요':selectedDepartment?.name??'학과를 골라 주세요'}</span><img src={chevronDown} alt=""/></button></label>
      <label>이수 학기<div className="counter"><button type="button" disabled={form.completedSemesters<=0} onClick={()=>change('completedSemesters',form.completedSemesters-1)}>−</button><b>{form.completedSemesters}</b><button type="button" disabled={form.completedSemesters>=8} onClick={()=>change('completedSemesters',form.completedSemesters+1)}>＋</button></div></label>
      <label>{expectedGraduationYear}년 2월 졸업 예정<div className="graduation-choice"><button type="button" className={form.graduationExpected?'selected':''} aria-pressed={form.graduationExpected} onClick={()=>change('graduationExpected',true)}><span className="graduation-check" aria-hidden="true">{form.graduationExpected?'✓':''}</span>예</button><button type="button" className={!form.graduationExpected?'selected':''} aria-pressed={!form.graduationExpected} onClick={()=>change('graduationExpected',false)}><span className="graduation-check" aria-hidden="true">{!form.graduationExpected?'✓':''}</span>아니요</button></div></label>
      <label>평점<input inputMode="decimal" value={form.gpa} onChange={event=>change('gpa',event.target.value)} placeholder="예: 3.4 (4.5 만점)"/></label>
    </div>{notice}<div className="profile-form-actions">{onCancel&&<button type="button" className="profile-previous" onClick={onCancel}><span aria-hidden="true">←</span>이전</button>}<button type="button" className="profile-next" onClick={goToLocation}>다음<span aria-hidden="true">→</span></button></div></div></>:step==='location'?<><div className="interest-heading"><h1 className="profile-title">사는 곳을 골라 주세요</h1></div><div className="location-step-card"><button type="button" className="profile-select-trigger" aria-label="사는 곳 선택" disabled={areas.loading||areas.error} onClick={()=>{setAreaQuery('');setAreaPicker(true)}}><span>{areas.loading?'불러오는 중…':areas.error?'지역 목록을 불러오지 못했어요':selectedArea?`${selectedArea.sido} ${selectedArea.name}`:'선택 안 함(서경대에서 출발로 계산)'}</span><img src={chevronDown} alt=""/></button><small>사는 곳을 선택하지 않으면 서경대학교를 기준으로 통근 시간을 계산합니다.</small></div>{notice}<div className="profile-form-actions location-actions"><button type="button" className="profile-previous" onClick={goToProfile}><span aria-hidden="true">←</span>이전</button><button type="button" className="profile-next" onClick={goToCertificates}>다음<span aria-hidden="true">→</span></button></div></>:step==='certificates'?<><div className="interest-heading"><h1 className="profile-title">가진 자격증을 골라 주세요</h1><p>이번 회차 직무가 요구 · 우대하는 자격증만 물어요. 없으면 고르지 않고 넘어가요.</p></div><div className="interest-options certificate-options">{certificates.loading?<p className="certificate-note">불러오는 중…</p>:certificates.error?<p className="certificate-note danger">자격증 목록을 불러오지 못했어요.</p>:<div className="interest-row">{(certificates.data?.certificates??[]).map(certificate=>{const selected=(form.certificates??[]).includes(certificate.code);return <button type="button" key={certificate.code} className={selected?'selected':''} aria-pressed={selected} onClick={()=>change('certificates',selected?form.certificates.filter(code=>code!==certificate.code):[...(form.certificates??[]),certificate.code])}>{selected&&<span className="interest-check" aria-hidden="true">✓</span>}{certificate.label}</button>})}</div>}<p className="certificate-note">{(form.certificates??[]).length?`${form.certificates.length}개 골랐어요.`:'고르지 않으면 \'없음\'으로 저장해요.'} 필수 자격증이 있는 직무는 여기서 고르지 않으면 지원 불가로 보여요.</p></div>{notice}<div className="profile-form-actions location-actions"><button type="button" className="profile-previous" onClick={goToLocationBack}><span aria-hidden="true">←</span>이전</button><button type="button" className="profile-next" onClick={goToInterests}>다음<span aria-hidden="true">→</span></button></div></>:<><div className="interest-heading"><h1 className="profile-title">관심 분야를 골라 주세요</h1></div><div className="interest-options">{interestRows.map((row,rowIndex)=><div className="interest-row" key={rowIndex}>{row.map(interest=>{const selected=selectedInterests.includes(interest);return <button type="button" key={interest} className={selected?'selected':''} aria-pressed={selected} onClick={()=>toggleInterest(interest)}>{selected&&<span className="interest-check" aria-hidden="true">✓</span>}{interest}</button>})}</div>)}</div>{customInterests.length>0&&<p className="interest-custom">직접 적어 둔 관심 {customInterests.map(item=><span key={item}>{item}<button type="button" aria-label={`${item} 빼기`} onClick={()=>removeCustomInterest(item)}>×</button></span>)}</p>}<label className={`check profile-consent ${consentMissing?'is-missing':''}`}><input type="checkbox" checked={consent} onChange={event=>{setConsent(event.target.checked);setConsentMissing(false);setMessage(null)}}/> 프로필 저장에 동의해요 · 지원 판정 · 직무 탐색 · 지원서에 쓰고, 내 정보에서 언제든 지울 수 있어요</label>{consentMissing&&<p className="profile-consent-hint" role="alert">저장하려면 동의에 체크해 주세요. 저장한 프로필로 지원 판정 · 직무 탐색 · 지원서를 써요.</p>}{notice}<div className="profile-form-actions interest-actions"><button type="button" className="profile-previous" disabled={saving} onClick={goToCertificatesBack}><span aria-hidden="true">←</span>이전</button><button type="button" className="profile-next" disabled={saving} onClick={save}>{saving?'저장 중…':'저장'}<span aria-hidden="true">→</span></button></div></>}
  </div>}</section>{departmentPicker&&<Modal className="profile-department-modal" close={()=>setDepartmentPicker(false)}>{dismiss=><><div className="department-modal-heading"><div><span>전공 선택</span><h2>학과를 골라 주세요</h2></div><button type="button" onClick={dismiss} aria-label="닫기">×</button></div><div className="department-search"><span aria-hidden="true">⌕</span><input autoFocus value={departmentQuery} onChange={event=>setDepartmentQuery(event.target.value)} placeholder="학과 이름으로 검색"/></div><div className="department-scroll-shell"><div ref={departmentListRef} className="department-list" role="listbox" aria-label="학과 목록" onScroll={updateDepartmentScrollbar}>{filteredDepartments.length?filteredDepartments.map(department=><button type="button" role="option" aria-selected={String(department.id)===form.departmentId} className={String(department.id)===form.departmentId?'selected':''} key={department.id} onClick={()=>{const departmentId=String(department.id);setDraft({...form,departmentId,interestText:departmentId===form.departmentId?form.interestText:''});setMessage(null);dismiss()}}><span>{department.name}</span>{department.college&&<small>{department.college}</small>}</button>):<p>검색 결과가 없어요.</p>}</div><div ref={scrollbarTrackRef} className={`department-scrollbar ${scrollbar.visible?'is-visible':''}`} aria-hidden="true"><span style={{height:scrollbar.height,transform:`translateY(${scrollbar.top}px)`}} onPointerDown={startScrollbarDrag} onPointerMove={moveScrollbarDrag} onPointerUp={stopScrollbarDrag} onPointerCancel={stopScrollbarDrag}/></div></div></>}</Modal>}{areaPicker&&<Modal className="profile-department-modal" close={()=>setAreaPicker(false)}>{dismiss=><><div className="department-modal-heading"><div><span>출발지 선택</span><h2>사는 곳을 골라 주세요</h2></div><button type="button" onClick={dismiss} aria-label="닫기">×</button></div><div className="department-search"><span aria-hidden="true">⌕</span><input autoFocus value={areaQuery} onChange={event=>setAreaQuery(event.target.value)} placeholder="시·군·구 이름으로 검색"/></div><div className="department-scroll-shell"><div ref={areaListRef} className="department-list" role="listbox" aria-label="지역 목록" onScroll={updateAreaScrollbar}><button type="button" role="option" aria-selected={!form.homeAreaCode} onClick={()=>{change('homeAreaCode','');dismiss()}}><span>선택 안 함 · 서경대학교에서 출발</span></button>{filteredAreas.length?filteredAreas.map(area=><button type="button" role="option" aria-selected={area.code===form.homeAreaCode} key={area.code} onClick={()=>{change('homeAreaCode',area.code);dismiss()}}><span>{area.sido} {area.name}</span></button>):<p>검색 결과가 없어요.</p>}</div><div className={`department-scrollbar ${areaScrollbar.visible?'is-visible':''}`} aria-hidden="true"><span style={{height:areaScrollbar.height,transform:`translateY(${areaScrollbar.top}px)`}} onPointerDown={startAreaScrollbarDrag} onPointerMove={moveAreaScrollbarDrag} onPointerUp={stopAreaScrollbarDrag} onPointerCancel={stopAreaScrollbarDrag}/></div></div></>}</Modal>}</Container>
}
