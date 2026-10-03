import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getMyProfile, saveMyProfile } from '../../api/myInfo'
import { getAreas, getDepartments } from '../../api/reference'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { SidePanel } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'

// 폼 값은 화면 상태로만 든다. 서버 저장은 [저장] + 동의 때만(AGENTS.md, 백엔드 ADR-0008).
const emptyForm = { departmentId: '', grade: null, completedSemesters: 0, gpa: '', graduationExpected: false, interestText: '', homeAreaCode: '' }

const toForm = (saved) => ({
  departmentId: String(saved.departmentId),
  grade: saved.grade,
  completedSemesters: saved.completedSemesters,
  gpa: String(saved.gpa),
  graduationExpected: saved.graduationExpected,
  interestText: saved.interestText ?? '',
  homeAreaCode: saved.homeAreaCode ?? '',
})

const toProfile = (form) => ({
  departmentId: Number(form.departmentId),
  grade: form.grade,
  completedSemesters: form.completedSemesters,
  gpa: Number(form.gpa),
  graduationExpected: form.graduationExpected,
  interestText: form.interestText.trim() || null,
  homeAreaCode: form.homeAreaCode || null,
})

const validate = (form) => {
  if (!form.departmentId) return '학과를 골라 주세요.'
  if (!form.grade) return '학년을 골라 주세요.'
  if (!/^\d(\.\d)?$/.test(form.gpa) || Number(form.gpa) > 4.5) return '평점은 0.0~4.5, 소수 첫째 자리까지 적어 주세요.'
  if (form.interestText.length > 200) return '관심 분야는 200자 이하로 적어 주세요.'
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

export function ProfilePage() {
  const [rules,setRules]=useState(false); const navigate=useNavigate()
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

  const save=async()=>{
    const invalid=validate(form)
    if(invalid){setMessage({tone:'danger',text:invalid});return}
    if(!loggedIn){setMessage({tone:'danger',text:'로그인하면 저장할 수 있어요.'});return}
    if(!consent){setMessage({tone:'danger',text:'저장하려면 동의에 체크해 주세요. 동의하지 않으면 이번 추천에만 쓰고 남기지 않아요.'});return}
    setSaving(true);setMessage(null)
    try{await saveMyProfile(toProfile(form));setMessage({tone:'',text:'프로필을 저장했어요.'})}
    catch(caught){setMessage({tone:'danger',text:saveErrorMessage(caught)})}
    finally{setSaving(false)}
  }

  const status=saved.loading?'저장한 프로필을 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.':saved.data?.isExample&&!draft?'예시 프로필을 불러왔어요. 고쳐서 저장할 수 있어요.':saved.data&&!draft?'저장한 프로필을 불러왔어요.':saved.error&&saved.error.code!=='PROFILE_NOT_FOUND'?'저장한 프로필을 불러오지 못했어요.':''
  const areaGroups=(areas.data?.areas??[]).reduce((groups,area)=>({...groups,[area.sido]:[...(groups[area.sido]??[]),area]}),{})

  return <main className="content two-column"><section><PageTitle eyebrow="나를 알려주세요" title="내 프로필" description="지원할 수 있는 직무를 정확히 찾는 데만 사용해요."/><div className="card form-card">{status&&<p className="notice" role="status">{status}</p>}<div className="form-grid">
    <label>학교<input value="서경대학교" readOnly/></label>
    <label>학년<div className="segments">{[1,2,3,4].map(grade=><button type="button" key={grade} className={form.grade===grade?'selected':''} onClick={()=>change('grade',grade)}>{grade}학년</button>)}</div></label>
    <label>학과<select value={form.departmentId} onChange={event=>change('departmentId',event.target.value)} disabled={departments.loading}><option value="">{departments.loading?'불러오는 중…':departments.error?'학과 목록을 불러오지 못했어요':'학과를 골라 주세요'}</option>{(departments.data?.departments??[]).map(department=><option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
    <label>이수 학기<div className="counter"><button type="button" disabled={form.completedSemesters<=0} onClick={()=>change('completedSemesters',form.completedSemesters-1)}>−</button><b>{form.completedSemesters}</b><button type="button" disabled={form.completedSemesters>=8} onClick={()=>change('completedSemesters',form.completedSemesters+1)}>＋</button></div></label>
    <label>사는 곳<select value={form.homeAreaCode} onChange={event=>change('homeAreaCode',event.target.value)} disabled={areas.loading}><option value="">{areas.loading?'불러오는 중…':'선택 안 함(서경대에서 출발로 계산)'}</option>{Object.entries(areaGroups).map(([sido,list])=><optgroup key={sido} label={sido}>{list.map(area=><option key={area.code} value={area.code}>{area.sido} {area.name}</option>)}</optgroup>)}</select></label>
    <label>평점<input inputMode="decimal" value={form.gpa} onChange={event=>change('gpa',event.target.value)} placeholder="예: 3.4 (4.5 만점)"/></label>
    <label>관심 분야(선택)<input value={form.interestText} maxLength={200} onChange={event=>change('interestText',event.target.value)} placeholder="예: 뷰티 브랜드 SNS 마케팅"/></label>
    <label className="check"><input type="checkbox" checked={form.graduationExpected} onChange={event=>change('graduationExpected',event.target.checked)}/> 다음 졸업(2027년 2월) 예정이에요.</label>
  </div><label className="check"><input type="checkbox" checked={consent} onChange={event=>{setConsent(event.target.checked);setMessage(null)}}/> 이 프로필을 다음 방문에도 사용할 수 있도록 저장합니다.</label><p className="notice">저장에 동의하지 않으면 이번 추천에만 사용하고 남기지 않아요.</p>{message&&<p className={`notice ${message.tone}`} role={message.tone?'alert':'status'}>{message.text}</p>}<button type="button" className="button primary" disabled={saving} onClick={save}>{saving?'저장하는 중…':'저장'}</button></div><button className="link-button" onClick={()=>setRules(true)}>학교 현장실습 규정 4가지 확인하기 →</button></section><ActionCard action={<button className="button primary full" onClick={()=>navigate('/jobs')}>이 프로필로 직무 찾기</button>}><h3>이 프로필로 확인할 내용</h3><ul><li>학년과 이수 학기</li><li>학과·전공 조건</li><li>기관별 별도 지원 조건</li></ul></ActionCard>{rules&&<SidePanel title="학교 규정 4가지" close={()=>setRules(false)}><ol className="rules"><li>현장실습 참여 학기 기준</li><li>최소 이수 학기 기준</li><li>학점 및 학적 상태 확인</li><li>학과별 승인 절차</li></ol><p className="notice">최종 지원 전 학교 담당자의 확인이 필요할 수 있어요.</p></SidePanel>}</main>
}
