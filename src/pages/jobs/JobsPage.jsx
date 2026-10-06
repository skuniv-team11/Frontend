import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { getToken, resolveApiAssetUrl } from '../../api/client'
import { getEligibility, getRecommendationReason, getRecommendations, toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, Toast } from '../../components/Shell'
import { useGuestStart } from '../../hooks/useGuestStart'
import { useRequest } from '../../hooks/useRequest'
import creativeMarketingBanner from '../../assets/images/job-banners/creative-marketing.png'
import beautyBrandBanner from '../../assets/images/job-banners/beauty-brand.png'
import dataTechBanner from '../../assets/images/job-banners/data-tech.png'
import coopRadarCareerBanner from '../../assets/images/job-banners/coop-radar-career-path.png'
import careerBook from '../../assets/images/interactive/career-book-flat.png'
import mirroredLoopArrow from '../../assets/images/decorations/mirrored-loop-arrow-v2.png'
import './JobsPage.css'

const verdictTone = { ELIGIBLE: 'green', NEEDS_CHECK: 'orange', INELIGIBLE: 'gray' }
const filters = [['ALL', '전체'], ['ELIGIBLE', '지원 가능'], ['NEEDS_CHECK', '확인 필요'], ['INELIGIBLE', '지원 불가']]
const jobTitlePrefixes = ['나에게 맞는 직무를 여기서', '관심 분야와 가까운 직무를', '지원할 수 있는 현장실습을']
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

const won = (amount) => `${amount.toLocaleString('ko-KR')}원`
const bannerImages = [creativeMarketingBanner,beautyBrandBanner,dataTechBanner]
const bannerMockCopy = [
  { detail: '12월 시작 · 4개월 과정' },
  { detail: '브랜드 프로젝트 · 실무 멘토링' },
  { detail: '디지털 프로젝트 · 협업 중심' },
]

function InteractiveCareerBook({ loggedIn }) {
  const [active,setActive]=useState(false)
  const [peeking,setPeeking]=useState(false)
  const [revealed,setRevealed]=useState(false)
  const [pulsing,setPulsing]=useState(false)
  const hoverTimer=useRef(null)
  const pulseTimer=useRef(null)
  const cancelHover=()=>window.clearTimeout(hoverTimer.current)
  const startHover=()=>{
    cancelHover()
    if(!active){
      setPeeking(true)
      hoverTimer.current=window.setTimeout(()=>setActive(true),1000)
    }
  }
  const leaveBook=()=>{cancelHover();if(!active)setPeeking(false)}
  const closeBook=()=>{cancelHover();window.clearTimeout(pulseTimer.current);setActive(false);setPeeking(false);setRevealed(false);setPulsing(false)}
  const openBook=()=>{
    if(!active){cancelHover();setPeeking(true);setActive(true);return}
    window.clearTimeout(pulseTimer.current)
    setRevealed(false)
    setPulsing(true)
    pulseTimer.current=window.setTimeout(()=>{setPulsing(false);setRevealed(true)},450)
  }
  useEffect(()=>{
    const closeOnEscape=(event)=>{if(event.key==='Escape')closeBook()}
    window.addEventListener('keydown',closeOnEscape)
    return()=>{cancelHover();window.clearTimeout(pulseTimer.current);window.removeEventListener('keydown',closeOnEscape)}
  },[])
  useEffect(()=>{
    if(!active)return undefined
    const previousBodyOverflow=document.body.style.overflow
    const previousHtmlOverflow=document.documentElement.style.overflow
    document.body.style.overflow='hidden'
    document.documentElement.style.overflow='hidden'
    return()=>{
      document.body.style.overflow=previousBodyOverflow
      document.documentElement.style.overflow=previousHtmlOverflow
    }
  },[active])
  return <>
    {active&&<button type="button" className="career-book-backdrop" aria-label="책 닫기" onClick={closeBook}/>}
    {active&&<div className="career-book-active-copy"><p>{loggedIn?<><span>합격한 선배들의</span><br/>자소서 꿀팁을 받아가세요.</>:<><span>로그인 후 합격한 선배들의</span><br/>자소서 꿀팁을 받아가세요.</>}</p><button type="button" className="career-book-dismiss" aria-label="책 닫기" onClick={closeBook}>×</button></div>}
    <button type="button" className={`career-book-trigger ${peeking?'is-peeking':''} ${active?'is-active':''} ${pulsing?'is-pulsing':''}`} aria-expanded={active} aria-label={active?'합격 자소서 팁 확인하기':'1초 동안 마우스를 올려 책 펼쳐 보기'} onMouseEnter={startHover} onMouseLeave={leaveBook} onFocus={startHover} onBlur={leaveBook} onClick={openBook}>
      <span className="career-book-hint">마우스를<br/>올려보세요<img src={mirroredLoopArrow} alt="" aria-hidden="true"/></span>
      <img src={careerBook} alt="현장실습 진로 안내 책"/>
    </button>
    {active&&revealed&&<p className="career-book-empty" role="status">아직 데이터가 없어요.</p>}
  </>
}

function JobsBanner({ jobs = [] }) {
  const navigate=useNavigate()
  const [active,setActive]=useState(0)
  const [paused,setPaused]=useState(false)
  const companyNames=new Set()
  const companyJobs=jobs.filter(job=>{
    const companyName=job.institution?.name?.trim()
    if(!companyName||companyNames.has(companyName))return false
    companyNames.add(companyName)
    return true
  }).slice(0,3)
  const banners=[...companyJobs.map((job,index)=>({kind:'job',job,image:bannerImages[index],copy:bannerMockCopy[index]})),{kind:'promo',key:'service-promo',image:coopRadarCareerBanner}]
  useEffect(()=>{
    if(paused||banners.length<2)return undefined
    const timer=window.setInterval(()=>setActive(current=>(current+1)%banners.length),4000)
    return()=>window.clearInterval(timer)
  },[paused,banners.length])
  const move=(direction)=>setActive(current=>(current+direction+banners.length)%banners.length)
  return <section className="jobs-banner" aria-roledescription="carousel" aria-label="직무 찾기 안내" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
    <div className="jobs-banner-track" style={{transform:`translateX(-${active*100}%)`}}>
      {banners.map((banner,index)=><article
        key={banner.kind==='job'?banner.job.jobId:banner.key}
        className={`jobs-banner-slide is-visual-${index} ${banner.kind==='promo'?'is-service-promo':''} ${banner.kind==='job'&&banner.job.institution.name.replace(/\s/g,'').includes('미디어코퍼스')?'is-media-corpus':''}`}
        style={{'--jobs-banner-image':`url(${banner.image})`}}
        role="link"
        tabIndex={active===index?0:-1}
        aria-hidden={active!==index}
        onClick={()=>navigate(banner.kind==='job'?`/jobs/${banner.job.jobId}`:'/plan')}
        onKeyDown={event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault()
            navigate(banner.kind==='job'?`/jobs/${banner.job.jobId}`:'/plan')
          }
        }}
      >
        {banner.kind==='job'?<div className="jobs-banner-copy"><div className="jobs-banner-company-inline"><InstitutionLogo institution={banner.job.institution}/><strong>{banner.job.institution.name}</strong></div><h2>{banner.job.title}</h2><p className="jobs-banner-meta">{banner.copy.detail}{banner.job.stipend?.amount?` · 월 ${won(banner.job.stipend.amount)}`:''}</p></div>:<div className="jobs-banner-copy jobs-banner-service-copy"><strong>현장뛰자.</strong><h2>나에게 맞는 현장실습을 한눈에</h2><p>직무 탐색부터 지원 순서까지 한곳에서 준비하세요.</p></div>}
      </article>)}
    </div>
    <button type="button" className="jobs-banner-arrow is-prev" aria-label="이전 배너" onClick={()=>move(-1)}>‹</button><button type="button" className="jobs-banner-arrow is-next" aria-label="다음 배너" onClick={()=>move(1)}>›</button>
    <div className="jobs-banner-pagination" aria-label="배너 선택">{banners.map((banner,index)=><button type="button" key={banner.kind==='job'?banner.job.jobId:banner.key} className={active===index?'is-active':''} aria-label={`${index+1}번째 배너`} aria-current={active===index?'true':undefined} onClick={event=>{event.stopPropagation();setActive(index)}}/>)}</div><span className="jobs-banner-count"><b>{active+1}</b> / {banners.length}</span>
  </section>
}

function InstitutionLogo({ institution, compact = false }) {
  const [failedSource,setFailedSource]=useState(null)
  const source=resolveApiAssetUrl(institution.logoPath)
  const fallback=(institution.name?.trim()?.[0]??'기').toUpperCase()
  return <span className={`institution-logo ${compact?'is-compact':''}`}>{source&&source!==failedSource?<img src={source} alt={`${institution.name} 로고`} loading="lazy" onError={()=>setFailedSource(source)}/>:<b aria-hidden="true">{fallback}</b>}</span>
}

function RecommendationReasonSheet({ reason, label, close }) {
  const [closing,setClosing]=useState(false)
  const closingRef=useRef(false)
  const closeRef=useRef(close)
  const closeTimer=useRef(null)
  const panelRef=useRef(null)
  const dragState=useRef({active:false,startY:0,offset:0})
  useEffect(()=>{closeRef.current=close},[close])
  const requestClose=useCallback(()=>{
    if(closingRef.current)return
    closingRef.current=true
    setClosing(true)
    closeTimer.current=window.setTimeout(()=>closeRef.current(),360)
  },[])
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const closeOnEscape=(event)=>{if(event.key==='Escape')requestClose()}
    document.body.style.overflow='hidden'
    window.addEventListener('keydown',closeOnEscape)
    return()=>{window.clearTimeout(closeTimer.current);document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape)}
  },[requestClose])
  const startDrag=(event)=>{
    if(closing)return
    const control=event.target.closest('button, a')
    if(control)return
    dragState.current={active:true,startY:event.clientY,offset:0}
    event.currentTarget.setPointerCapture(event.pointerId)
    panelRef.current?.classList.add('is-dragging','has-dragged')
  }
  const moveDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    const offset=Math.max(-90,event.clientY-dragState.current.startY)
    dragState.current.offset=offset
    panelRef.current.style.setProperty('--sheet-drag-y',`${offset}px`)
    panelRef.current.style.transform=`translateY(${offset}px)`
  }
  const endDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    dragState.current.active=false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const panel=panelRef.current
    panel.classList.remove('is-dragging')
    if(dragState.current.offset>=panel.getBoundingClientRect().height*.2){requestClose();return}
    panel.classList.add('is-settling')
    panel.style.transform='translateY(0)'
    panel.style.setProperty('--sheet-drag-y','0px')
    window.setTimeout(()=>panel.classList.remove('is-settling'),300)
  }
  return createPortal(<div className={`reason-sheet-overlay ${closing?'is-closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}><section ref={panelRef} className="reason-sheet" role="dialog" aria-modal="true" aria-labelledby="reason-sheet-title" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><span className="reason-sheet-grip" aria-hidden="true"/><button type="button" className="reason-sheet-close" aria-label="닫기" onClick={requestClose}>×</button><div className="reason-sheet-heading"><div><span>AI RECOMMENDATION</span><h2 id="reason-sheet-title">이 직무를 추천하는 이유</h2></div><div className="reason-panel-badges"><Badge tone={verdictTone[reason.verdict]}>{label('verdict',reason.verdict)}</Badge><Badge>적합도 {label('fit',reason.fit)}</Badge></div></div><div className="reason-sheet-job"><small>{reason.institution.name}</small><h3>{reason.title}</h3><p>{reason.reasonTemplate}</p></div>{(reason.citations??[]).length>0&&<div className="reason-sheet-citations">{reason.citations.map((citation,index)=><article key={index}><span>원문 근거 {index+1}</span><blockquote>“{citation.quote}”</blockquote><p>{label('sourceType',citation.sourceType)} · {citation.documentTitle} · {citation.page}쪽</p></article>)}</div>}<Link className="reason-sheet-detail" to={`/jobs/${reason.jobId}`}>직무 상세 보기 <span>→</span></Link></section></div>,document.body)
}

// 추천 카드 하나. reasonStatus가 PENDING이면 이유 문장 API를 불러 바꾼다(2~6초). 그동안·실패 때는 규칙 문장(reasonTemplate)을 보여 준다.
function RecommendationCard({ item, profile, label, openReason, saved, adding, saveItem, keepActionsOpen }) {
  const navigate=useNavigate()
  const loadReason = useCallback((signal) => getRecommendationReason(item.jobId, profile, signal), [item.jobId, profile])
  const reason = useRequest(loadReason, item.reasonStatus === 'PENDING')
  const text = reason.data?.text ?? item.reasonTemplate
  const citations = reason.data?.citations ?? item.citations
  const openDetail=()=>navigate(`/jobs/${item.jobId}`)
  return <article className={`recommend-card ${keepActionsOpen?'actions-open':''}`} role="link" tabIndex="0" onClick={openDetail} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDetail()}}}><div className="recommend-card-top"><span className="recommend-rank">추천 {item.rank}</span><div><Badge tone={verdictTone[item.verdict]}>{label('verdict', item.verdict)}</Badge><Badge>적합도 {label('fit', item.fit)}</Badge></div></div><div className="recommend-company-block"><InstitutionLogo institution={item.institution}/><small className="recommend-company">{item.institution.name}</small></div><h3>{item.title}</h3><p className="recommend-meta">{label('jobType', item.jobType)}{item.stipend?.amount ? ` · ${label('stipendBasis', item.stipend.basis)} ${won(item.stipend.amount)}` : ''}</p><p className="recommend-reason"><span className="recommend-ai-label">AI</span>{text}</p><div className="recommend-card-bottom"><button type="button" disabled={reason.loading} onClick={event=>{event.stopPropagation();if(!reason.loading)openReason({...item,reasonTemplate:text,citations})}}>추천 이유 보기</button><button type="button" className={`recommend-save-button ${saved?'saved':''}`} disabled={adding} onClick={event=>{event.stopPropagation();saveItem(item.jobId)}}>{adding?<i className="save-button-spinner" aria-label="처리 중"/>:saved?'담았어요':'담기'}</button></div></article>
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

function LoginRequired() {
  const { start, loadingRole, error } = useGuestStart()
  return <main className="jobs-login-page"><section className="jobs-login-content"><div className="jobs-login-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2"/><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M12 14v3"/></svg></div><span className="jobs-login-kicker">로그인하고</span><h1>나에게 맞는 직무를 찾아보세요</h1><div className="jobs-login-actions"><Link className="jobs-login-button" to="/login">로그인하러 가기</Link><button type="button" className="jobs-example-button" disabled={loadingRole!==null} onClick={()=>start('STUDENT')}>{loadingRole==='STUDENT'?'예시 프로필 준비 중…':'예시 프로필로 시작하기'}</button></div>{error&&<p className="jobs-login-error" role="alert">{error}</p>}</section></main>
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

  if(!loggedIn)return <><InteractiveCareerBook loggedIn={false}/><LoginRequired/></>
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

  return <main className="content wide jobs-page jobs-page-ready"><InteractiveCareerBook loggedIn={loggedIn}/><div className="jobs-page-inner"><JobsBanner jobs={[...(recommendations.data?.items??[]),...jobs]}/><div className="jobs-heading"><PageTitle title={<span className="jobs-title-composed"><span className={`jobs-title-message ${titleMotion}`}>{jobTitlePrefixes[titleIndex]}</span><span className="jobs-title-fixed">찾아보세요</span></span>}/><div className="result-summary"><div><small>추천</small><b>{recommendations.data?.items.length??'–'}</b></div><div><small>지원 가능</small><b>{summary.eligible}</b></div><div><small>확인 필요</small><b>{summary.needsCheck}</b></div><div><small>전체</small><b>{summary.total}</b></div></div></div>
    <div id="recommendations" className="jobs-scroll-anchor"><RecommendationSection recommendations={recommendations} profile={profileBody} label={label} openReason={setRecommendReason} savedIds={savedIds} adding={adding} saveItem={save} activeJobId={saveToast?.jobId}/></div>
    <section id="all-jobs" className="card jobs-list"><div className="list-header"><div className="job-list-title"><span>ALL POSITIONS</span><b>전체 직무</b><form className="job-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="직무명 검색" aria-label="직무명 검색"/><button type="submit">검색</button></form></div><div className={`job-list-control ${controlsLeaving?'is-leaving':'is-entering'}`}>{appliedSearch?<button type="button" className="show-all-jobs" onClick={showAllJobs}>전체 직무 보기</button>:<div className="filter">{filters.map(([key,name])=><button key={key} className={filter===key?'selected':''} onClick={()=>changeFilter(key)}>{name} <b>{counts[key]}</b></button>)}</div>}</div></div><div className="job-list-columns"><span>직무·기관</span><span>전공 조건</span><span>판정</span><span>모집 상태</span><span>관리</span></div><div className={`job-list-results ${listMotion}`}>
      {saveError&&<p className="notice danger" role="alert">{saveError}</p>}
      {shown.length===0&&<p className="notice">{appliedSearch?`‘${appliedSearch}’가 제목에 포함된 직무가 없어요.`:'이 판정에 해당하는 직무가 없어요.'}</p>}
      {shown.map(job=><div className="job-row" role="link" tabIndex="0" key={job.jobId} onClick={()=>navigate(`/jobs/${job.jobId}`)} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();navigate(`/jobs/${job.jobId}`)}}}><div className="job-main"><InstitutionLogo institution={job.institution} compact/><div><b>{job.title}</b><small>{job.institution.name} · {job.team}</small></div></div><div className="job-major"><Badge>{label('majorMatch',job.majorMatch)}</Badge>{job.alertCount>0&&<Badge tone="orange">문서 검토</Badge>}</div><div><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge></div><span className={`job-closing ${isClosed(job)?'is-closed':'is-open'}`}>{isClosed(job)?'마감':job.closing.closesOn?`${formatDay(dayBefore(job.closing.closesOn))} 마감`:'모집 중'}</span><div className="job-actions"><button className={`save-button ${savedIds.includes(job.jobId)?'saved':''}`} disabled={adding!==null||plan.loading} title={savedIds.includes(job.jobId)?'다시 누르면 담기를 취소해요':undefined} onClick={event=>{event.stopPropagation();save(job.jobId)}}>{adding===job.jobId?<i className="save-button-spinner" aria-label="처리 중"/>:savedIds.includes(job.jobId)?'담았어요':'담기'}</button></div></div>)}
    </div></section>
    {recommendReason&&<RecommendationReasonSheet reason={recommendReason} label={label} close={()=>setRecommendReason(null)}/>}
    {saveToast&&<Toast key={saveToast.id} className="first-save-toast" onAnimationEnd={()=>setSaveToast(current=>current?.id===saveToast.id?null:current)}><span className={`first-save-toast-icon ${saveToast.type}`} aria-hidden="true">{saveToast.type==='removed'?'−':'✓'}</span><div><b>{saveToast.message}</b><small>내 지망에서 담은 직무를 확인할 수 있어요.</small></div><Link to="/plan">내 지망 보기</Link></Toast>}
  </div></main>
}
