import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getEligibility, getRecommendationReason, getRecommendations, toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, SidePanel, Toast } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import './JobsPage.css'

const verdictTone = { ELIGIBLE: 'green', NEEDS_CHECK: 'orange', INELIGIBLE: 'gray' }
const filters = [['ALL', '전체'], ['ELIGIBLE', '지원 가능'], ['NEEDS_CHECK', '확인 필요'], ['INELIGIBLE', '지원 불가']]
const jobTitlePrefixes = ['나에게 맞는 직무를 여기서', '관심 분야와 가까운 직무를', '지원할 수 있는 현장실습을']
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

const won = (amount) => `${amount.toLocaleString('ko-KR')}원`

// 추천 카드 하나. reasonStatus가 PENDING이면 이유 문장 API를 불러 바꾼다(2~6초). 그동안·실패 때는 규칙 문장(reasonTemplate)을 보여 준다.
function RecommendationCard({ item, profile, label, openReason, saved, adding, saveItem, keepActionsOpen }) {
  const navigate=useNavigate()
  const loadReason = useCallback((signal) => getRecommendationReason(item.jobId, profile, signal), [item.jobId, profile])
  const reason = useRequest(loadReason, item.reasonStatus === 'PENDING')
  const text = reason.data?.text ?? item.reasonTemplate
  const citations = reason.data?.citations ?? item.citations
  const openDetail=()=>navigate(`/jobs/${item.jobId}`)
  return <article className={`recommend-card ${keepActionsOpen?'actions-open':''}`} role="link" tabIndex="0" onClick={openDetail} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDetail()}}}><div className="recommend-card-top"><span className="recommend-rank">추천 {item.rank}</span><div><Badge tone={verdictTone[item.verdict]}>{label('verdict', item.verdict)}</Badge><Badge>적합도 {label('fit', item.fit)}</Badge></div></div><small className="recommend-company">{item.institution.name}</small><h3>{item.title}</h3><p className="recommend-meta">{label('jobType', item.jobType)}{item.stipend?.amount ? ` · ${label('stipendBasis', item.stipend.basis)} ${won(item.stipend.amount)}` : ''}</p><p className="recommend-reason">{text}</p><div className="recommend-card-bottom"><button type="button" disabled={reason.loading} onClick={event=>{event.stopPropagation();if(!reason.loading)openReason({...item,reasonTemplate:text,citations})}}>추천 이유 보기</button><button type="button" className={`recommend-save-button ${saved?'saved':''}`} disabled={adding} onClick={event=>{event.stopPropagation();saveItem(item.jobId)}}>{adding?<i className="save-button-spinner" aria-label="처리 중"/>:saved?'담았어요':'담기'}</button></div></article>
}

// 추천 5개. 판정 목록과 따로 불러와서, 늦거나 실패해도 아래 목록은 그대로 보인다.
function RecommendationSection({ recommendations, profile, label, openReason, savedIds, adding, saveItem, activeJobId }) {
  if (recommendations.loading) return <p className="notice">관심 분야와 가까운 직무를 고르는 중…</p>
  if (recommendations.error) return <p className="notice danger">추천을 불러오지 못했어요. 아래 전체 직무에서 골라 보세요.</p>
  const { items, blockedBy } = recommendations.data
  if (!items.length) return <p className="notice">지금 조건으로 추천할 직무가 없어요.{blockedBy.length > 0 && ` ${blockedBy.map(block => `${block.item} 때문에 ${block.count}개`).join(', ')}가 빠졌어요.`}</p>
  return <section className="recommendations">{items.map(item => <RecommendationCard key={item.jobId} item={item} profile={profile} label={label} openReason={openReason} saved={savedIds.includes(item.jobId)} adding={adding===item.jobId} saveItem={saveItem} keepActionsOpen={activeJobId===item.jobId}/>)}</section>
}

function Blocked({ children }) {
  return <main className="content wide jobs-page"><div className="jobs-page-inner"><PageTitle title="지원할 수 있는 직무를 모았어요"/><div className="card form-card jobs-blocked-card">{children}</div></div></main>
}

function JobsLoading({ message, detail }) {
  return <main className="jobs-loading-page"><div className="jobs-loading-content" role="status"><i className="jobs-loading-spinner" aria-hidden="true"/><strong>LOADING</strong><span>{message}</span><small>{detail}</small></div></main>
}

export function JobsPage() {
  const navigate=useNavigate()
  const [titleIndex,setTitleIndex]=useState(0)
  const [titleMotion,setTitleMotion]=useState('')
  useEffect(()=>{
    let changeTimer;let enterTimer
    const interval=window.setInterval(()=>{
      setTitleMotion('is-leaving')
      changeTimer=window.setTimeout(()=>{
        setTitleIndex(current=>(current+1)%jobTitlePrefixes.length)
        setTitleMotion('is-entering')
        enterTimer=window.setTimeout(()=>setTitleMotion(''),60)
      },760)
    },6000)
    return()=>{window.clearInterval(interval);window.clearTimeout(changeTimer);window.clearTimeout(enterTimer)}
  },[])
  const loggedIn=Boolean(getToken())
  const profile=useRequest(getMyProfile,loggedIn)
  const loadEligibility=useCallback((signal)=>getEligibility(toProfileBody(profile.data),signal),[profile.data])
  const eligibility=useRequest(loadEligibility,Boolean(profile.data))
  const profileBody=useMemo(()=>profile.data?toProfileBody(profile.data):null,[profile.data])
  const loadRecommendations=useCallback((signal)=>getRecommendations(profileBody,signal),[profileBody])
  const recommendations=useRequest(loadRecommendations,Boolean(profile.data))
  const round=useRequest(getCurrentRound)
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value

  const [filter,setFilter]=useState('ALL'); const [searchQuery,setSearchQuery]=useState(''); const [appliedSearch,setAppliedSearch]=useState(''); const [recommendReason,setRecommendReason]=useState(null)
  const [listMotion,setListMotion]=useState(''); const [controlsLeaving,setControlsLeaving]=useState(false); const filterTimer=useRef(null); const enterTimer=useRef(null)
  useEffect(()=>()=>{window.clearTimeout(filterTimer.current);window.clearTimeout(enterTimer.current)},[])
  const transitionResults=(update,swapControls=false)=>{
    if(listMotion==='is-leaving')return
    window.clearTimeout(filterTimer.current);window.clearTimeout(enterTimer.current)
    setListMotion('is-leaving');if(swapControls)setControlsLeaving(true)
    filterTimer.current=window.setTimeout(()=>{
      update();setListMotion('is-entering');setControlsLeaving(false)
      enterTimer.current=window.setTimeout(()=>setListMotion(''),50)
    },260)
  }
  const changeFilter=(nextFilter)=>{if(nextFilter!==filter)transitionResults(()=>setFilter(nextFilter))}
  const submitSearch=(event)=>{
    event.preventDefault()
    const nextSearch=searchQuery.trim()
    if(!nextSearch||nextSearch===appliedSearch)return
    transitionResults(()=>{setAppliedSearch(nextSearch);setFilter('ALL')},!appliedSearch)
  }
  const showAllJobs=()=>transitionResults(()=>{setAppliedSearch('');setSearchQuery('');setFilter('ALL')},true)
  // 담기: 이미 담은 직무는 GET /api/me/plan으로 알고, 누를 때마다 담기(POST)·담기 취소(DELETE)를 오간다
  const plan=useRequest(getMyPlan,Boolean(profile.data))
  const [added,setAdded]=useState([]); const [removed,setRemoved]=useState([]); const [adding,setAdding]=useState(null); const [saveError,setSaveError]=useState(''); const [saveToast,setSaveToast]=useState(null); const saveToastId=useRef(0)
  const savedIds=[...(plan.data?.items.map(item=>item.jobId)??[]),...added].filter(id=>!removed.includes(id))
  const save=async(id)=>{
    if(adding!==null)return
    const isSaved=savedIds.includes(id)
    setAdding(id);setSaveError('')
    try{
      if(isSaved){await removePlanItem(id);setRemoved(current=>[...current,id]);setAdded(current=>current.filter(item=>item!==id));setSaveToast({id:++saveToastId.current,jobId:id,type:'removed',message:'담기를 취소했어요'})}
      else{await addPlanItem(id);setAdded(current=>[...current,id]);setRemoved(current=>current.filter(item=>item!==id));setSaveToast({id:++saveToastId.current,jobId:id,type:'added',message:'직무를 담았어요'})}
    }
    catch(caught){setSaveError(planErrorMessage(caught,isSaved?'빼기':'담기'))}
    finally{setAdding(null)}
  }

  if(!loggedIn)return <Blocked><p className="notice">로그인하거나 [예시 프로필로 시작]을 누르면 내 조건으로 판정해 드려요.</p><Link className="link-button" to="/login">로그인하기 →</Link></Blocked>
  if(profile.loading)return <JobsLoading message="직무를 찾을 준비를 하고 있어요" detail="저장한 프로필을 확인하고 있습니다."/>
  if(profile.error?.code==='PROFILE_NOT_FOUND')return <Blocked><p className="notice">판정에 쓸 프로필이 없어요. 프로필을 입력하고 저장하면 지원할 수 있는 직무를 찾아 드려요.</p><Link className="link-button" to="/profile">프로필 입력하기 →</Link></Blocked>
  if(profile.error?.code==='FORBIDDEN_ROLE')return <Blocked><p className="notice">직무 판정은 학생 계정에서만 볼 수 있어요.</p></Blocked>
  if(profile.error?.status===401)return <Blocked><p className="notice">로그인 정보가 없거나 만료됐어요.</p><Link className="link-button" to="/login">다시 로그인하기 →</Link></Blocked>
  if(profile.error)return <Blocked><p className="notice danger">프로필을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p></Blocked>
  if(eligibility.loading)return <JobsLoading message="내 조건에 맞는 직무를 찾고 있어요" detail="공고의 지원 조건을 하나씩 비교하고 있습니다."/>
  if(eligibility.error)return <Blocked><p className="notice danger">{eligibility.error.code==='INVALID_INPUT'?`프로필 값을 확인해 주세요. ${eligibility.error.fields.map(field=>field.reason).join(' · ')}`:'판정 결과를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'}</p><Link className="link-button" to="/profile">프로필 확인하기 →</Link></Blocked>

  const {summary,jobs}=eligibility.data
  const asOf=round.data?.replay?.defaultAsOf
  const isClosed=(job)=>Boolean(job.closing.closesOn&&asOf&&job.closing.closesOn<=asOf)
  const counts={ALL:summary.total,ELIGIBLE:summary.eligible,NEEDS_CHECK:summary.needsCheck,INELIGIBLE:summary.ineligible}
  const normalizedQuery=appliedSearch.toLowerCase()
  const shown=jobs.filter(job=>(filter==='ALL'||job.verdict===filter)&&(!normalizedQuery||job.title.toLowerCase().includes(normalizedQuery)))

  return <main className="content wide jobs-page jobs-page-ready"><div className="jobs-page-inner"><div className="jobs-heading"><PageTitle title={<span className="jobs-title-composed"><span className={`jobs-title-message ${titleMotion}`}>{jobTitlePrefixes[titleIndex]}</span><span className="jobs-title-fixed">찾아보세요</span></span>}/><div className="result-summary"><div><small>추천</small><b>{recommendations.data?.items.length??'–'}</b></div><div><small>지원 가능</small><b>{summary.eligible}</b></div><div><small>확인 필요</small><b>{summary.needsCheck}</b></div><div><small>전체</small><b>{summary.total}</b></div></div></div>
    <RecommendationSection recommendations={recommendations} profile={profileBody} label={label} openReason={setRecommendReason} savedIds={savedIds} adding={adding} saveItem={save} activeJobId={saveToast?.jobId}/>
    <section className="card jobs-list"><div className="list-header"><div className="job-list-title"><span>ALL POSITIONS</span><b>전체 직무</b><form className="job-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="직무명 검색" aria-label="직무명 검색"/><button type="submit">검색</button></form></div><div className={`job-list-control ${controlsLeaving?'is-leaving':'is-entering'}`}>{appliedSearch?<button type="button" className="show-all-jobs" onClick={showAllJobs}>전체 직무 보기</button>:<div className="filter">{filters.map(([key,name])=><button key={key} className={filter===key?'selected':''} onClick={()=>changeFilter(key)}>{name} <b>{counts[key]}</b></button>)}</div>}</div></div><div className="job-list-columns"><span>직무·기관</span><span>전공 조건</span><span>판정</span><span>모집 상태</span><span>관리</span></div><div className={`job-list-results ${listMotion}`}>
      {saveError&&<p className="notice danger" role="alert">{saveError}</p>}
      {shown.length===0&&<p className="notice">{appliedSearch?`‘${appliedSearch}’가 제목에 포함된 직무가 없어요.`:'이 판정에 해당하는 직무가 없어요.'}</p>}
      {shown.map(job=><div className="job-row" role="link" tabIndex="0" key={job.jobId} onClick={()=>navigate(`/jobs/${job.jobId}`)} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();navigate(`/jobs/${job.jobId}`)}}}><div className="job-main"><b>{job.title}</b><small>{job.institution.name} · {job.team}</small></div><div className="job-major"><Badge>{label('majorMatch',job.majorMatch)}</Badge>{job.alertCount>0&&<Badge tone="orange">문서 검토</Badge>}</div><div><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge></div><span className={`job-closing ${isClosed(job)?'is-closed':'is-open'}`}>{isClosed(job)?'마감':job.closing.closesOn?`${formatDay(dayBefore(job.closing.closesOn))} 마감`:'모집 중'}</span><div className="job-actions"><button className={`save-button ${savedIds.includes(job.jobId)?'saved':''}`} disabled={adding!==null||plan.loading} title={savedIds.includes(job.jobId)?'다시 누르면 담기를 취소해요':undefined} onClick={event=>{event.stopPropagation();save(job.jobId)}}>{adding===job.jobId?<i className="save-button-spinner" aria-label="처리 중"/>:savedIds.includes(job.jobId)?'담았어요':'담기'}</button></div></div>)}
    </div></section>
    {recommendReason&&<SidePanel className="recommendation-reason-panel" title="추천 근거" close={()=>setRecommendReason(null)}><div className="reason-panel-badges"><Badge tone={verdictTone[recommendReason.verdict]}>{label('verdict',recommendReason.verdict)}</Badge><Badge>적합도 {label('fit',recommendReason.fit)}</Badge></div><h3>{recommendReason.title}</h3><p>{recommendReason.reasonTemplate}</p>{(recommendReason.citations??[]).map((citation,index)=><div key={index}><blockquote>“{citation.quote}”</blockquote><p className="source">{label('sourceType',citation.sourceType)} · {citation.documentTitle} · {citation.page}쪽</p></div>)}<Link className="button primary full" to={`/jobs/${recommendReason.jobId}`}>직무 상세 보기</Link></SidePanel>}
    {saveToast&&<Toast key={saveToast.id} className="first-save-toast" onAnimationEnd={()=>setSaveToast(current=>current?.id===saveToast.id?null:current)}><span className={`first-save-toast-icon ${saveToast.type}`} aria-hidden="true">{saveToast.type==='removed'?'−':'✓'}</span><div><b>{saveToast.message}</b><small>내 지망에서 담은 직무를 확인할 수 있어요.</small></div><Link to="/plan">내 지망 보기</Link></Toast>}
  </div></main>
}
