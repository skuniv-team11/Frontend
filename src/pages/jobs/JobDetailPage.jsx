import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getToken, resolveApiAssetUrl } from '../../api/client'
import { getCommute, getJob, getJobViews } from '../../api/jobs'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCodes } from '../../api/reference'
import { Badge } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import './JobDetailPage.css'

const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
const won = (amount) => `${amount.toLocaleString('ko-KR')}원`

function DetailInstitutionLogo({ institution }) {
  const [failedSource,setFailedSource]=useState(null)
  const source=resolveApiAssetUrl(institution.logoPath)
  const fallback=(institution.name?.trim()?.[0]??'기').toUpperCase()
  return <div className="job-detail-institution-logo">{source&&source!==failedSource?<img src={source} alt={`${institution.name} 로고`} onError={()=>setFailedSource(source)}/>:<><b aria-hidden="true">{fallback}</b><small>{institution.name}</small></>}</div>
}

// 통근 칸. 출발지는 저장한 프로필의 사는 곳(없거나 센터 계정이면 서경대). 결과는 이 화면 상태로만 들고 저장하지 않는다(AGENTS.md).
function CommuteCard({ jobId, hasCoordinates, label, workplace }) {
  const profile = useRequest(getMyProfile, Boolean(getToken()))
  const homeAreaCode = profile.data?.homeAreaCode ?? null
  const loadCommute = useCallback((signal) => getCommute(jobId, homeAreaCode, signal), [jobId, homeAreaCode])
  const commute = useRequest(loadCommute, hasCoordinates && !profile.loading)
  const body = !hasCoordinates ? <p>근무지 주소가 없어 통근 시간을 계산할 수 없어요.</p>
    : profile.loading || commute.loading ? <p role="status">통근 시간을 불러오는 중… 카카오맵 대중교통 기준으로 계산하고 있어요.</p>
    : commute.error ? <p>통근 시간을 불러오지 못했어요. <button className="link-button" onClick={commute.reload}>다시 불러오기</button></p>
    : !commute.data.available ? <p>{commute.data.origin.label}에서 출발 · 카카오맵 대중교통 기준<br/>통근 시간을 불러오지 못했어요({label('commuteUnavailable', commute.data.unavailableReason)}). <button className="link-button" onClick={commute.reload}>다시 불러오기</button></p>
    : <><p><b>{commute.data.origin.label}</b>에서 출발 · {label('commuteProvider', commute.data.provider)} 대중교통 기준{commute.data.origin.type === 'SCHOOL' && ' (사는 곳을 저장하지 않아 서경대에서 출발로 계산했어요)'}</p><div><strong>약 {commute.data.minutes}분</strong><span>환승 {commute.data.transfers}회{commute.data.fareWon != null && ` · 요금 ${commute.data.fareWon.toLocaleString('ko-KR')}원`}</span></div></>
  return <section className="commute"><h2>통근</h2><p className="commute-workplace"><b>근무지</b> · {workplace||'주소 미기재'}</p><div className="commute-body">{body}</div></section>
}

function DetailError({ error }) {
  if (error.code === 'JOB_NOT_FOUND') return <p className="notice">없는 직무예요. <Link className="link-button" to="/jobs">직무 찾기로 돌아가기 →</Link></p>
  if (error.status === 401) return <p className="notice">로그인하면 직무 상세를 볼 수 있어요. <Link className="link-button" to="/login">로그인하기 →</Link></p>
  if (error.code === 'NETWORK') return <p className="notice danger">서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
  return <p className="notice danger">직무 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
}

function DetailLoading({ complete }) {
  return <main className="job-detail-loading-page"><section className={`job-detail-loading ${complete?'is-complete':''}`} role="status"><div className="job-detail-loading-mark" aria-hidden="true">{complete?'✓':<i/>}</div><strong>{complete?'분석이 완료됐어요':'LOADING'}</strong><p>{complete?'정리한 정보와 원문 근거를 보여드릴게요.':'직무 정보를 읽고 있어요.'}</p><small>{complete?'':'공고의 지원 조건을 하나씩 확인하고 있습니다.'}</small></section></main>
}

export function JobDetailPage() {
  const {id}=useParams()
  const location=useLocation()
  const navigate=useNavigate()
  const goBack=()=>location.key==='default'?navigate('/jobs',{replace:true}):navigate(-1)
  const loadJob=useCallback((signal)=>getJob(id,signal),[id])
  const job=useRequest(loadJob)
  // 조회수는 상세를 받은 뒤에 부른다 — 상세(GET /api/jobs/{id})를 열 때 서버가 이번 조회를 먼저 센다
  const loadViews=useCallback((signal)=>getJobViews(id,signal),[id])
  const views=useRequest(loadViews,Boolean(job.data))
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  const [detailReady,setDetailReady]=useState(false)
  const [activeSection,setActiveSection]=useState('job-requirements')
  const activeScrollTimer=useRef(null); const activeScrollLock=useRef(false)
  useEffect(()=>()=>window.clearTimeout(activeScrollTimer.current),[])
  useEffect(()=>{
    if(!job.data)return undefined
    const timer=window.setTimeout(()=>setDetailReady(true),450)
    return()=>window.clearTimeout(timer)
  },[job.data])
  useEffect(()=>{
    if(!detailReady)return undefined
    const sectionIds=['job-requirements','job-overview','job-conditions','job-evidence','job-institution']
    let frame=0
    const updateActiveSection=()=>{
      window.cancelAnimationFrame(frame)
      frame=window.requestAnimationFrame(()=>{
        if(activeScrollLock.current)return
        const sections=sectionIds.map(sectionId=>document.getElementById(sectionId)).filter(Boolean)
        if(!sections.length)return
        if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4){setActiveSection(sections.at(-1).id);return}
        const current=sections.filter(section=>section.getBoundingClientRect().top<=150).at(-1)??sections[0]
        setActiveSection(current.id)
      })
    }
    updateActiveSection()
    window.addEventListener('scroll',updateActiveSection,{passive:true})
    window.addEventListener('resize',updateActiveSection)
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener('scroll',updateActiveSection);window.removeEventListener('resize',updateActiveSection)}
  },[detailReady])
  // 담고 내 지망으로 간다. 이미 담겨 있어도(200) 그대로 이동한다
  const plan=useRequest(getMyPlan,Boolean(getToken()))
  const [adding,setAdding]=useState(false); const [savedOverride,setSavedOverride]=useState(null); const [addError,setAddError]=useState('')
  const planSaved=Boolean(plan.data?.items?.some(item=>String(item.jobId)===String(id)))
  const saved=savedOverride??planSaved
  const addToPlan=async()=>{if(adding||plan.loading)return;const isSaved=saved;setAdding(true);setAddError('');try{if(isSaved)await removePlanItem(Number(id));else await addPlanItem(Number(id));setSavedOverride(!isSaved)}catch(caught){setAddError(planErrorMessage(caught,isSaved?'빼기':'담기'))}finally{setAdding(false)}}

  if(job.loading||(job.data&&!detailReady))return <DetailLoading complete={Boolean(job.data)}/>
  if(job.error)return <main className="content two-column"><section><button className="back job-detail-back-button" type="button" onClick={goBack}>← 뒤로가기</button><DetailError error={job.error}/></section></main>

  const detail=job.data; const {institution,conditions,requirements,closing}=detail
  const requirementRows=[
    ['학년',label('gradeRule',requirements.gradeRule)],
    ['학점',requirements.gpaMin!=null?`평점 ${requirements.gpaMin} 이상`:'조건 없음'],
    ['선호 전공',requirements.majorOpen?'전공 무관':`${requirements.majorText}${requirements.majorAliases.length?` → ${requirements.majorAliases.flatMap(alias=>alias.departments.map(department=>department.name)).join(', ')}`:''}`],
    ['포트폴리오',label('requirement',requirements.portfolio)],
    ['자격증',`${label('requirement',requirements.certificate)}${requirements.certificateText?` · ${requirements.certificateText}`:''}`],
  ]
  const conditionRows=[
    ['실습 과정',label('course',conditions.course)],
    ['실습 유형',label('jobType',conditions.jobType)],
    ['실습 기간',conditions.period?`${conditions.period.start} ~ ${conditions.period.end}`:'미기재'],
    ['실습 시간',`${conditions.workHoursText??'미기재'}${conditions.weeklyHours?` · 주 ${conditions.weeklyHours}시간`:''}`],
    ['실습 요일',(conditions.weekdays??[]).map(day=>label('weekday',day)).join(', ')||'미기재'],
    ['연장 실습',label('overtime',conditions.overtime)],
    ['근로계약',conditions.laborContract?'있음':'없음'],
    ['실습지원비',conditions.stipend?.amount?`${label('stipendBasis',conditions.stipend.basis)} ${won(conditions.stipend.amount)}${conditions.stipend.minWageRatio!=null?` (최저임금 대비 ${conditions.stipend.minWageRatio}%)`:''}`:'미기재'],
    ['복리후생',(conditions.benefits??[]).map(benefit=>label('benefit',benefit)).join(', ')||'없음'],
    ['모집 인원',`${conditions.headcount}명`],
  ]
  const institutionRows=[
    ['기관명',institution.name],
    ['규모',`${label('size',institution.size)} · ${label('listing',institution.listing)}`],
    ['업태',institution.businessType??'미기재'],
    ['종목',institution.businessItem??'미기재'],
    ['주소',institution.address??'미기재'],
    ['사업자 상태',`${label('ntsStatus',institution.ntsStatus)}${institution.ntsCheckedOn?` (${institution.ntsCheckedOn} 확인)`:''}`],
  ]

  return <main className="job-detail-page"><button className="job-detail-fixed-back" type="button" onClick={goBack}>← 뒤로가기</button><div className="job-detail-shell"><header className="job-detail-hero"><div className="job-detail-hero-main"><DetailInstitutionLogo institution={institution}/><div className="job-detail-hero-copy"><span className="job-detail-eyebrow">{institution.name} · {detail.team}</span><h1>{detail.title}</h1><div className="job-detail-meta"><Badge tone="blue">{label('jobType',conditions.jobType)}</Badge><Badge>{label('course',conditions.course)}</Badge>{closing.closesOn&&<Badge tone="orange">{formatDay(dayBefore(closing.closesOn))} 마감{closing.closesOnIsVirtual?'(가상)':''}</Badge>}{detail.alerts.length>0&&<Badge tone="orange">문서 검토 {detail.alerts.length}건</Badge>}{views.data&&<Badge>조회 {views.data.views.toLocaleString('ko-KR')} · 오늘 {views.data.todayViews.toLocaleString('ko-KR')}</Badge>}</div></div></div><button className={`job-detail-save ${saved?'is-saved':''}`} disabled={adding||plan.loading} onClick={addToPlan}>{adding?<i className="job-detail-button-spinner" aria-label="처리 중"/>:saved?'담았어요':'담기'}</button></header>
    <section className="job-detail-highlights"><div><span>실습지원비</span><strong>{conditions.stipend?.amount?`${label('stipendBasis',conditions.stipend.basis)} ${won(conditions.stipend.amount)}`:'미기재'}</strong></div><div><span>실습 기간</span><strong>{conditions.period?`${conditions.period.start} ~ ${conditions.period.end}`:'미기재'}</strong></div><div><span>모집 인원</span><strong>{conditions.headcount}명</strong></div><div><span>근무지</span><strong>{detail.workplace.address??institution.address??'미기재'}</strong></div></section>
    {addError&&<p className="notice danger" role="alert">{addError}</p>}
    <nav className="job-detail-nav" aria-label="직무 상세 바로가기">{[['job-requirements','지원 조건'],['job-overview','하는 일'],['job-conditions','실습 조건'],['job-evidence','공고 정보'],['job-institution','기관 정보']].map(([sectionId,name])=><a className={activeSection===sectionId?'is-active':''} aria-current={activeSection===sectionId?'location':undefined} href={`#${sectionId}`} key={sectionId} onClick={event=>{event.preventDefault();window.clearTimeout(activeScrollTimer.current);activeScrollLock.current=true;setActiveSection(sectionId);document.getElementById(sectionId)?.scrollIntoView({behavior:'smooth',block:'start'});activeScrollTimer.current=window.setTimeout(()=>{activeScrollLock.current=false},850)}}>{name}</a>)}</nav>
    <div className="job-detail-content">
      <section className="job-detail-section" id="job-requirements"><span className="job-detail-section-number">01</span><div className="job-detail-section-body"><p className="job-detail-kicker">REQUIREMENTS</p><h2>지원 조건</h2><dl className="job-detail-rows">{requirementRows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl></div></section>
      <section className="job-detail-section" id="job-overview"><span className="job-detail-section-number">02</span><div className="job-detail-section-body"><p className="job-detail-kicker">ROLE</p><h2>이런 일을 해요</h2><p className="job-detail-lead">{detail.overview}</p><div className="job-detail-two-up"><div><h3>교육 목표</h3><p>{detail.educationGoal}</p></div><div><h3>요구 역량</h3><p>{detail.competencies}</p></div></div>{detail.weeklyPlan.length>0&&<div className="job-detail-weekly"><h3>주차별 계획</h3>{detail.weeklyPlan.map(week=><div key={week.seq}><b>{week.weeksLabel}</b><span>{week.content}</span></div>)}</div>}</div></section>
      <section className="job-detail-section" id="job-conditions"><span className="job-detail-section-number">03</span><div className="job-detail-section-body"><p className="job-detail-kicker">CONDITIONS</p><h2>실습 조건</h2><dl className="job-detail-rows is-grid">{conditionRows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><CommuteCard jobId={detail.id} hasCoordinates={detail.workplace.hasCoordinates} workplace={detail.workplace.address??institution.address} label={label}/></div></section>
      <section className="job-detail-section job-detail-evidence-section" id="job-evidence"><span className="job-detail-section-number">04</span><div className="job-detail-section-body"><p className="job-detail-kicker">POSTING INFORMATION</p><h2>공고 정보</h2><div className="job-detail-evidence-list">{detail.evidence.map((item,index)=><article style={{'--evidence-index':index}} key={`${item.fieldKey}-${index}`}><h3>{item.label}</h3><strong>{item.rawValue||'미기재'}</strong></article>)}</div><p className="job-detail-caution">표시된 값은 원문과 다를 수 있어요. 최종 지원 전 원문을 확인하세요.</p></div></section>
      <section className="job-detail-section" id="job-institution"><span className="job-detail-section-number">05</span><div className="job-detail-section-body"><p className="job-detail-kicker">INSTITUTION</p><h2>기관 정보</h2><dl className="job-detail-rows">{institutionRows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>{detail.seniorNotes.length>0&&<div className="job-detail-senior"><h3>선배 수기</h3>{detail.seniorNotes.map((note,index)=><article key={`${note.termCode}-${index}`}><b>{note.termCode} · {note.teamText}</b><ul>{note.activities.map(activity=><li key={activity}>{activity}</li>)}</ul><small>{note.documentTitle} · {note.page}쪽</small></article>)}</div>}</div></section>
    </div>
  </div></main>
}
