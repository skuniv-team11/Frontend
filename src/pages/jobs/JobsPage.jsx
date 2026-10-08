import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getToken, resolveApiAssetUrl } from '../../api/client'
import { getEligibility, getRecommendationReason, getRecommendations, toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCodes, getCurrentRound } from '../../api/reference'
import { getJobViews } from '../../api/jobs'
import { useJobViews } from '../../hooks/useJobViews'
import { PageTitle } from '../../components/PageParts'
import { Badge, Toast } from '../../components/Shell'
import { useGuestStart } from '../../hooks/useGuestStart'
import { useRequest } from '../../hooks/useRequest'
import theSmcBanner from '../../assets/images/job-banners/the-smc.png'
import sejungBanner from '../../assets/images/job-banners/sejung.png'
import ovlrBanner from '../../assets/images/job-banners/ovlr.png'
import champstudyBanner from '../../assets/images/job-banners/champstudy.png'
import logenBanner from '../../assets/images/job-banners/logen.png'
import sundosoftBanner from '../../assets/images/job-banners/sundosoft.png'
import soserBanner from '../../assets/images/job-banners/soser.png'
import jsoopBanner from '../../assets/images/job-banners/jsoop.png'
import wearefriendsBanner from '../../assets/images/job-banners/wearefriends.png'
import smithBanner from '../../assets/images/job-banners/smith.png'
import deltatechBanner from '../../assets/images/job-banners/deltatech.png'
import beyondmarketingBanner from '../../assets/images/job-banners/beyondmarketing.png'
import abtAsiaBanner from '../../assets/images/job-banners/abt-asia.png'
import mediaCorpusBanner from '../../assets/images/job-banners/media-corpus.png'
import jikjinBanner from '../../assets/images/job-banners/jikjin.png'
import equiKoreaBanner from '../../assets/images/job-banners/equi-korea.png'
import buildingDoctorBanner from '../../assets/images/job-banners/building-doctor.png'
import avenueJunoBanner from '../../assets/images/job-banners/avenue-juno.png'
import coopRadarCareerBanner from '../../assets/images/job-banners/coop-radar-career-path.png'
import careerBook from '../../assets/images/interactive/career-book-flat.png'
import mirroredLoopArrow from '../../assets/images/decorations/mirrored-loop-arrow-v2.png'
import './JobsPage.css'

const verdictTone = { ELIGIBLE: 'green', NEEDS_CHECK: 'orange', INELIGIBLE: 'gray' }
const reasonResultLabel = { MET: '충족', NOT_MET: '미충족', CHECK: '확인 필요', INFO: '참고' }
const filters = [['ALL', '전체'], ['ELIGIBLE', '지원 가능'], ['NEEDS_CHECK', '확인 필요'], ['INELIGIBLE', '지원 불가']]
const jobTitlePrefixes = ['나에게 맞는 직무를 여기서', '관심 분야와 가까운 직무를', '지원할 수 있는 현장실습을']
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

const won = (amount) => `${amount.toLocaleString('ko-KR')}원`
const fixedJobBanners = [
  { key: 'the-smc', jobId: 101, image: theSmcBanner, tone: 'dark', institution: { id: 1, name: '더에스엠씨', logoPath: '/logos/1.png', logoStyle: 'wide' }, title: 'AE', detail: '광고사업부 · 디지털 캠페인 기획' },
  { key: 'sejung', jobId: 102, image: sejungBanner, tone: 'light', institution: { id: 2, name: '세정', logoPath: '/logos/2.png', logoStyle: 'wide' }, title: 'SNS, 영상', detail: '디지털미디어팀 · 브랜드 콘텐츠 제작' },
  { key: 'ovlr', jobId: 110, image: ovlrBanner, tone: 'light', institution: { id: 3, name: '오뷔엘알', logoPath: '/logos/3.png', logoStyle: 'wide' }, title: '의상디자인', detail: '패션 디자인 · 브랜드 실무' },
  { key: 'champstudy', jobId: 115, image: champstudyBanner, tone: 'dark', institution: { id: 4, name: '챔프스터디', logoPath: '/logos/4.png', logoStyle: 'wide' }, title: '영상 콘텐츠 디자인', detail: '교육 콘텐츠 · 영상 제작 실무' },
  { key: 'logen', jobId: 117, image: logenBanner, tone: 'light', institution: { id: 5, name: '로젠', logoPath: '/logos/5.png', logoStyle: 'wide' }, title: '회계업무지원', detail: '물류 기업 · 경영 지원 실무' },
  { key: 'sundosoft', jobId: 119, image: sundosoftBanner, tone: 'dark', institution: { id: 6, name: '선도소프트', logoPath: '/logos/6.png', logoStyle: 'wide' }, title: 'AI·데이터 기반 소프트웨어 개발', detail: 'AI·데이터 · 시스템 구축 실무' },
  { key: 'soser', jobId: 122, image: soserBanner, tone: 'warm', institution: { id: 7, name: '소서', logoPath: '/logos/7.png', logoStyle: 'wide' }, title: '국내 마케팅', detail: '브랜드 마케팅 · 이커머스 실무' },
  { key: 'jsoop', jobId: 125, image: jsoopBanner, tone: 'warm', institution: { id: 8, name: '제이숲', logoPath: '/logos/8.png', logoStyle: 'wide' }, title: '바이럴마케팅', detail: '헤어케어 브랜드 · 콘텐츠 마케팅' },
  { key: 'wearefriends', jobId: 130, image: wearefriendsBanner, tone: 'light', institution: { id: 9, name: '위아프렌즈', logoPath: '/logos/9.png', logoStyle: 'wide' }, title: '한국 여행 콘텐츠 제작', detail: '여행 콘텐츠 · 기획 및 제작' },
  { key: 'smith', jobId: 132, image: smithBanner, tone: 'light', institution: { id: 10, name: '스미스', logoPath: '/logos/10.png' }, title: '마케팅솔루션 인턴', detail: '마케팅솔루션팀 · 전략 기획' },
  { key: 'deltatech', jobId: 133, image: deltatechBanner, tone: 'dark', institution: { id: 11, name: '델타텍코리아', logoPath: '/logos/11.png', logoStyle: 'wide' }, title: '디지털 기술무역·협업 과제 기획', detail: '기술무역 · 오픈이노베이션 실무' },
  { key: 'beyondmarketing', jobId: 134, image: beyondmarketingBanner, tone: 'dark', institution: { id: 12, name: '비욘드마케팅그룹', logoPath: '/logos/12.png' }, title: '디지털 통합 광고대행사 실습', detail: '디지털 광고 · 캠페인 운영' },
  { key: 'abt-asia', jobId: 135, image: abtAsiaBanner, tone: 'warm', institution: { id: 13, name: '에이비티아시아', logoPath: '/logos/13.png', logoStyle: 'wide' }, title: '패키지 디자인 인턴', detail: '패키지 디자인 · 브랜드 제작 실무' },
  { key: 'media-corpus', jobId: 136, image: mediaCorpusBanner, tone: 'dark', institution: { id: 14, name: '미디어 코퍼스', logoPath: '/logos/14.png', logoStyle: 'wide' }, title: 'AI 학습데이터 구축 및 품질관리', detail: 'AI 데이터 · 구축 및 검수 실무' },
  { key: 'jikjin', jobId: 137, image: jikjinBanner, tone: 'dark', institution: { id: 15, name: '직진코퍼레이션', logoPath: '/logos/15.png', logoStyle: 'wide' }, title: 'Business Development 인턴', detail: '중국 시장 · 사업개발 실무' },
  { key: 'equi-korea', jobId: 138, image: equiKoreaBanner, tone: 'light', institution: { id: 16, name: '에퀴코리아', logoPath: '/logos/16.png', logoStyle: 'wide' }, title: '통역 프로젝트 매니저', detail: '통역 프로젝트 · 운영 및 협업' },
  { key: 'building-doctor', jobId: 139, image: buildingDoctorBanner, tone: 'light', institution: { id: 17, name: '빌딩닥터엔지니어링', logoPath: '/logos/17.png', logoStyle: 'wide' }, title: '건축물안전진단', detail: '건축물 진단 · 안전 엔지니어링' },
  { key: 'avenue-juno', jobId: 140, image: avenueJunoBanner, tone: 'warm', institution: { id: 18, name: '애브뉴준오 더현대서울점', logoPath: '/logos/18.png', logoStyle: 'wide' }, title: '미용 시술 보조', detail: '헤어 살롱 · 고객 서비스 실무' },
]
const arrangedJobBanners = [fixedJobBanners.at(-1), ...fixedJobBanners.slice(1, -1), fixedJobBanners[0]]

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
    {!active&&<span className={`career-book-hint ${peeking?'is-peeking':''}`}>마우스를<br/>올려보세요<img src={mirroredLoopArrow} alt="" aria-hidden="true"/></span>}
    <button type="button" className={`career-book-trigger ${peeking?'is-peeking':''} ${active?'is-active':''} ${pulsing?'is-pulsing':''}`} aria-expanded={active} aria-label={active?'합격 자소서 팁 확인하기':'1초 동안 마우스를 올려 책 펼쳐 보기'} onMouseEnter={startHover} onMouseLeave={leaveBook} onFocus={startHover} onBlur={leaveBook} onClick={openBook}>
      <span className="career-book-hit-area" aria-hidden="true"/>
      <img src={careerBook} alt="현장실습 진로 안내 책"/>
    </button>
    {active&&revealed&&<p className="career-book-empty" role="status">아직 데이터가 없어요.</p>}
  </>
}

function JobsBanner() {
  const navigate=useNavigate()
  const location=useLocation()
  const [active,setActive]=useState(()=>Number.isInteger(location.state?.jobsBannerIndex)?location.state.jobsBannerIndex:0)
  const [paused,setPaused]=useState(false)
  const banners=[...arrangedJobBanners.map(banner=>({kind:'job',...banner})),{kind:'promo',key:'service-promo',image:coopRadarCareerBanner}]
  useEffect(()=>{
    if(paused||banners.length<2)return undefined
    const timer=window.setInterval(()=>setActive(current=>(current+1)%banners.length),4000)
    return()=>window.clearInterval(timer)
  },[paused,banners.length])
  const move=(direction)=>setActive(current=>(current+direction+banners.length)%banners.length)
  const openBanner=(banner)=>{
    if(banner.kind!=='job'){navigate('/plan');return}
    window.history.replaceState({...window.history.state,usr:{...(window.history.state?.usr??{}),jobsBannerIndex:active}},'')
    navigate(`/jobs/${banner.jobId}`,{state:{returnScrollY:window.scrollY,returnBannerIndex:active}})
  }
  return <section className="jobs-banner" aria-roledescription="carousel" aria-label="직무 찾기 안내" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}}>
    <div className="jobs-banner-track" style={{transform:`translateX(-${active*100}%)`}}>
      {banners.map((banner,index)=><article
        key={banner.key}
        className={`jobs-banner-slide is-${banner.key} ${banner.kind==='job'?`is-layout-${index%4+1}`:''} ${banner.institution?.logoStyle==='wide'?'has-wide-logo':''} ${banner.tone?`is-tone-${banner.tone}`:''} ${banner.kind==='promo'?'is-service-promo':''}`}
        style={{'--jobs-banner-image':`url(${banner.image})`}}
        role="link"
        tabIndex={active===index?0:-1}
        aria-hidden={active!==index}
        onClick={()=>openBanner(banner)}
        onKeyDown={event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault()
            openBanner(banner)
          }
        }}
      >
        {banner.kind==='job'?<div className="jobs-banner-copy"><div className="jobs-banner-company-inline"><InstitutionLogo institution={banner.institution}/><strong>{banner.institution.name}</strong></div><h2>{banner.title}</h2><p className="jobs-banner-meta">{banner.detail}</p></div>:<div className="jobs-banner-copy jobs-banner-service-copy"><strong>현장뛰자.</strong><h2>나에게 맞는 현장실습을 한눈에</h2><p>직무 탐색부터 지원 순서까지 한곳에서 준비하세요.</p></div>}
      </article>)}
    </div>
    <button type="button" className="jobs-banner-arrow is-prev" aria-label="이전 배너" onClick={()=>move(-1)}>‹</button><button type="button" className="jobs-banner-arrow is-next" aria-label="다음 배너" onClick={()=>move(1)}>›</button>
    <div className="jobs-banner-pagination" aria-label="배너 선택">{banners.map((banner,index)=><button type="button" key={banner.key} className={active===index?'is-active':''} aria-label={`${index+1}번째 배너`} aria-current={active===index?'true':undefined} onClick={event=>{event.stopPropagation();setActive(index)}}/>)}</div><span className="jobs-banner-count"><b>{active+1}</b> / {banners.length}</span>
  </section>
}

function InstitutionLogo({ institution, compact = false }) {
  const [failedSource,setFailedSource]=useState(null)
  const source=institution.logoSrc??resolveApiAssetUrl(institution.logoPath)
  const fallback=(institution.name?.trim()?.[0]??'기').toUpperCase()
  return <span className={`institution-logo ${compact?'is-compact':''}`}>{source&&source!==failedSource?<img src={source} alt={`${institution.name} 로고`} loading="lazy" onError={()=>setFailedSource(source)}/>:<b aria-hidden="true">{fallback}</b>}</span>
}

export function RecommendationReasonSheet({ reason, label, close }) {
  const [closing,setClosing]=useState(false)
  const closingRef=useRef(false)
  const closeRef=useRef(close)
  const closeTimer=useRef(null)
  const panelRef=useRef(null)
  const contentRef=useRef(null)
  const scrollbarTrackRef=useRef(null)
  const scrollbarDragRef=useRef(null)
  const [scrollbar,setScrollbar]=useState({top:0,height:0,visible:false})
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
  const updateScrollbar=useCallback(()=>{
    const content=contentRef.current
    const track=scrollbarTrackRef.current
    if(!content||!track)return
    const visible=content.scrollHeight>content.clientHeight
    const height=visible?Math.max(42,track.clientHeight*(content.clientHeight/content.scrollHeight)):0
    const travel=track.clientHeight-height
    const top=visible&&content.scrollHeight>content.clientHeight?(content.scrollTop/(content.scrollHeight-content.clientHeight))*travel:0
    setScrollbar({top,height,visible})
  },[])
  useLayoutEffect(()=>{
    const frame=window.requestAnimationFrame(updateScrollbar)
    const observer=new ResizeObserver(updateScrollbar)
    if(contentRef.current)observer.observe(contentRef.current)
    return()=>{window.cancelAnimationFrame(frame);observer.disconnect()}
  },[reason,updateScrollbar])
  const startScrollbarDrag=(event)=>{
    const content=contentRef.current
    if(!content)return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    scrollbarDragRef.current={startY:event.clientY,startScroll:content.scrollTop}
  }
  const moveScrollbarDrag=(event)=>{
    const content=contentRef.current
    const track=scrollbarTrackRef.current
    if(!content||!track||!scrollbarDragRef.current)return
    event.stopPropagation()
    const travel=track.clientHeight-scrollbar.height
    const scrollTravel=content.scrollHeight-content.clientHeight
    if(travel>0)content.scrollTop=scrollbarDragRef.current.startScroll+(event.clientY-scrollbarDragRef.current.startY)*(scrollTravel/travel)
  }
  const stopScrollbarDrag=(event)=>{event.stopPropagation();scrollbarDragRef.current=null}
  const startDrag=(event)=>{
    if(closing)return
    const control=event.target.closest('button, a, .reason-sheet-scrollbar')
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
  const criteria=reason.eligibilityReasons??[]
  const checkReasons=criteria.filter(item=>item.result==='CHECK')
  const documentReasons=criteria.filter(item=>item.alertId!=null)
  const verdictSummary=reason.verdict==='ELIGIBLE'?'현재 프로필로 확인되는 필수 지원 조건을 충족했어요.':reason.verdict==='NEEDS_CHECK'?'프로필만으로 확정할 수 없는 조건이 있어 원문이나 담당자 확인이 필요해요.':'현재 프로필에서 충족하지 못한 필수 조건이 있어요.'
  const fitSummary=reason.fit==='HIGH'?'전공·관심 분야와 직무 내용이 여러 기준에서 가깝게 연결돼 적합도를 높음으로 표시했어요.':'일부 관심 분야와 연결되지만 직접 맞닿는 기준이 제한적이라 적합도를 보통으로 표시했어요.'
  return createPortal(<div className={`reason-sheet-overlay ${closing?'is-closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}><section ref={panelRef} className="reason-sheet" role="dialog" aria-modal="true" aria-labelledby="reason-sheet-title" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><span className="reason-sheet-grip" aria-hidden="true"/><button type="button" className="reason-sheet-close" aria-label="닫기" onClick={requestClose}>×</button><div className="reason-sheet-scroll-shell"><div ref={contentRef} className="reason-sheet-scroll-content" onScroll={updateScrollbar}><div className="reason-sheet-heading"><div><span>AI RECOMMENDATION</span><h2 id="reason-sheet-title">이 직무를 추천하는 이유</h2></div><div className="reason-panel-badges"><Badge tone={verdictTone[reason.verdict]}>{label('verdict',reason.verdict)}</Badge><Badge>적합도 {label('fit',reason.fit)}</Badge>{reason.alertCount>0&&<Badge tone="orange">문서 검토 {reason.alertCount}건</Badge>}</div></div><div className="reason-sheet-job"><small>{reason.institution.name}</small><h3>{reason.title}</h3><p>{reason.reasonTemplate}</p></div><div className="reason-sheet-explanations"><section><span>지원 판정</span><h3>{label('verdict',reason.verdict)}인 이유</h3><p>{verdictSummary}</p></section><section><span>적합도</span><h3>{label('fit',reason.fit)}으로 본 이유</h3><p>{fitSummary}</p></section></div>{criteria.length>0&&<div className="reason-sheet-criteria"><h3>조건별 판단 근거</h3>{criteria.map((item,index)=><article key={`${item.layer}-${item.item}-${index}`}><div><b>{item.item}</b><dl><div><dt>필요 조건</dt><dd>{item.requirement}</dd></div><div><dt>내 조건</dt><dd>{item.mine}</dd></div></dl></div><span className={`is-${item.result.toLowerCase()}`}>{reasonResultLabel[item.result]??item.result}</span></article>)}</div>}{(checkReasons.length>0||reason.alertCount>0)&&<div className="reason-sheet-checks"><h3>확인 필요·문서 검토</h3>{checkReasons.length>0&&<p>확인 필요 조건 {checkReasons.length}개는 내 프로필만으로 판정할 수 없어 원문 확인이 필요해요.</p>}{reason.alertCount>0&&<p>공고 문서에서 서로 다르거나 추가 확인이 필요한 내용 {reason.alertCount}건을 찾았어요.{documentReasons.length?' 아래 조건과 원문 근거를 함께 확인해 주세요.':''}</p>}</div>}{(reason.citations??[]).length>0&&<div className="reason-sheet-citations">{reason.citations.map((citation,index)=><article key={index}><span>원문 근거 {index+1}</span><blockquote>“{citation.quote}”</blockquote><p>{label('sourceType',citation.sourceType)} · {citation.documentTitle} · {citation.page}쪽</p></article>)}</div>}<div className="reason-sheet-scroll-end" aria-hidden="true"/></div><div ref={scrollbarTrackRef} className={`reason-sheet-scrollbar ${scrollbar.visible?'is-visible':''}`} aria-hidden="true"><span style={{height:scrollbar.height,transform:`translateY(${scrollbar.top}px)`}} onPointerDown={startScrollbarDrag} onPointerMove={moveScrollbarDrag} onPointerUp={stopScrollbarDrag} onPointerCancel={stopScrollbarDrag}/></div></div><div className="reason-sheet-footer"><Link className="reason-sheet-detail" to={`/jobs/${reason.jobId}`} state={{returnScrollY:window.scrollY}}>직무 상세 보기 <span>→</span></Link></div></section></div>,document.body)
}

// 추천 카드 하나. reasonStatus가 PENDING이면 이유 문장 API를 불러 바꾼다(2~6초). 그동안·실패 때는 규칙 문장(reasonTemplate)을 보여 준다.
const viewsText = (views) => views ? ` · 조회 ${views.views.toLocaleString('ko-KR')}` : ''

function DecisionPreview({ type, reasons = [], count = 0, interactiveChild = false, children }) {
  const anchorRef=useRef(null)
  const popoverRef=useRef(null)
  const timerRef=useRef(null)
  const [preview,setPreview]=useState(null)
  const matchingReasons=reasons.filter(reason=>type==='document'?(reason.alertId!=null||reason.citation):reason.result==='CHECK')
  useLayoutEffect(()=>{
    if(!preview?.anchor||!popoverRef.current)return
    const rect=preview.anchor
    const popover=popoverRef.current.getBoundingClientRect()
    const edge=16
    const gap=10
    const roomRight=window.innerWidth-rect.right-edge
    const roomLeft=rect.left-edge
    if(roomRight>=popover.width||roomLeft>=popover.width){
      const placeRight=roomRight>=popover.width
      const left=placeRight?rect.right+gap:rect.left-popover.width-gap
      const top=rect.top+popover.height<=window.innerHeight-edge
        ? Math.max(edge,rect.top)
        : Math.max(edge,rect.bottom-popover.height)
      setPreview({left,top,placement:placeRight?'right':'left'})
      return
    }
    const roomBelow=window.innerHeight-rect.bottom-edge
    const roomAbove=rect.top-edge
    if(roomBelow>=popover.height||roomAbove>=popover.height){
      const above=roomBelow<popover.height
      const left=Math.max(edge,Math.min(rect.left,window.innerWidth-popover.width-edge))
      setPreview({left,top:above?rect.top-gap:rect.bottom+gap,placement:above?'above':'below'})
      return
    }
    const placeRight=roomRight>=popover.width||roomRight>=roomLeft
    const unclampedLeft=placeRight?rect.right+gap:rect.left-popover.width-gap
    const left=Math.max(edge,Math.min(unclampedLeft,window.innerWidth-popover.width-edge))
    const top=rect.top+popover.height<=window.innerHeight-edge
      ? Math.max(edge,rect.top)
      : Math.max(edge,rect.bottom-popover.height)
    setPreview({left,top,placement:placeRight?'right':'left'})
  },[preview])
  const show=()=>{
    window.clearTimeout(timerRef.current)
    timerRef.current=window.setTimeout(()=>{
      const rect=anchorRef.current?.getBoundingClientRect()
      if(!rect)return
      setPreview({left:rect.left,top:rect.bottom+10,placement:'measuring',anchor:rect})
    },200)
  }
  const hide=()=>{window.clearTimeout(timerRef.current);setPreview(null)}
  useEffect(()=>()=>window.clearTimeout(timerRef.current),[])
  const title=type==='document'?'문서 검토 미리보기':'확인 필요 이유'
  return <span ref={anchorRef} className="decision-preview-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex={interactiveChild?undefined:'0'}>
    {children}
    {preview&&createPortal(<aside ref={popoverRef} className={`decision-preview-popover is-${preview.placement}`} style={{left:preview.left,top:preview.top}} role="tooltip"><div className="decision-preview-heading"><b>{title}</b>{type==='document'&&<span>{count||matchingReasons.length}건</span>}</div>{matchingReasons.length?<div className="decision-preview-list">{matchingReasons.slice(0,3).map((reason,index)=><article key={`${reason.layer}-${reason.item}-${index}`}><strong>{reason.item}</strong><p><span>필요 조건</span>{reason.requirement}</p><p><span>내 조건</span>{reason.mine}</p>{reason.citation?.quote&&<blockquote>“{reason.citation.quote}”</blockquote>}{reason.citation&&<small>{reason.citation.documentTitle} · {reason.citation.page}쪽</small>}</article>)}</div>:<p className="decision-preview-empty">세부 내용은 직무 상세에서 확인할 수 있어요.</p>}</aside>,document.body)}
  </span>
}

function RecommendationCard({ item, eligibilityJob, profile, label, openReason, saved, adding, saveItem, keepActionsOpen, views }) {
  const navigate=useNavigate()
  const loadReason = useCallback((signal) => getRecommendationReason(item.jobId, profile, signal), [item.jobId, profile])
  const reason = useRequest(loadReason, item.reasonStatus === 'PENDING')
  const text = reason.data?.text ?? item.reasonTemplate
  const citations = reason.data?.citations ?? item.citations
  const openDetail=()=>navigate(`/jobs/${item.jobId}`,{state:{returnScrollY:window.scrollY}})
  const showReason=(event)=>{event.stopPropagation();openReason({...item,reasonTemplate:text,citations,eligibilityReasons:eligibilityJob?.reasons??[],alertCount:eligibilityJob?.alertCount??0})}
  const verdictBadge=<button type="button" className="recommend-insight-button" onClick={showReason}><Badge tone={verdictTone[item.verdict]}>{label('verdict', item.verdict)}</Badge></button>
  const showFitBadge=!eligibilityJob?.alertCount
  return <article className={`recommend-card ${keepActionsOpen?'actions-open':''}`} role="link" tabIndex="0" onClick={openDetail} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openDetail()}}}><div className="recommend-card-top"><span className="recommend-rank">추천 {item.rank}</span><div>{item.verdict==='NEEDS_CHECK'?<DecisionPreview type="check" reasons={eligibilityJob?.reasons} interactiveChild>{verdictBadge}</DecisionPreview>:verdictBadge}{eligibilityJob?.alertCount>0&&<DecisionPreview type="document" reasons={eligibilityJob.reasons} count={eligibilityJob.alertCount} interactiveChild><button type="button" className="recommend-insight-button" onClick={showReason}><Badge tone="orange">문서 검토</Badge></button></DecisionPreview>}{showFitBadge&&<button type="button" className="recommend-insight-button" onClick={showReason}><Badge>적합도 {label('fit', item.fit)}</Badge></button>}</div></div><div className="recommend-company-block"><InstitutionLogo institution={item.institution}/><small className="recommend-company">{item.institution.name}</small></div><h3>{item.title}</h3><p className="recommend-meta">{label('jobType', item.jobType)}{item.stipend?.amount ? ` · ${label('stipendBasis', item.stipend.basis)} ${won(item.stipend.amount)}` : ''}</p><p className="recommend-reason"><span className="recommend-ai-label">AI</span>{text}</p><p className={`recommend-views ${views?'':'is-pending'}`} aria-hidden={!views}>{views?`조회 ${views.views.toLocaleString('ko-KR')}`:'조회 0'}</p><div className="recommend-card-bottom"><button type="button" onClick={showReason}>추천 이유 보기</button><button type="button" className={`recommend-save-button ${saved?'saved':''}`} disabled={adding} onClick={event=>{event.stopPropagation();saveItem(item.jobId)}}>{adding?<i className="save-button-spinner" aria-label="처리 중"/>:saved?'담았어요':'담기'}</button></div></article>
}

// 추천 5개. 판정 목록과 따로 불러와서, 늦거나 실패해도 아래 목록은 그대로 보인다.
function RecommendationSection({ recommendations, eligibilityByJob, profile, label, openReason, savedIds, adding, saveItem, activeJobId, viewsByJob }) {
  if (recommendations.loading) return <p className="notice">관심 분야와 가까운 직무를 고르는 중…</p>
  if (recommendations.error) return <p className="notice danger">추천을 불러오지 못했어요. 아래 전체 직무에서 골라 보세요.</p>
  const { items, blockedBy } = recommendations.data
  if (!items.length) return <p className="notice">지금 조건으로 추천할 직무가 없어요.{blockedBy.length > 0 && ` ${blockedBy.map(block => `${block.item} 때문에 ${block.count}개`).join(', ')}가 빠졌어요.`}</p>
  return <section className="recommendations">{items.map(item => <RecommendationCard key={item.jobId} item={item} eligibilityJob={eligibilityByJob?.[item.jobId]} profile={profile} label={label} openReason={openReason} saved={savedIds.includes(item.jobId)} adding={adding===item.jobId} saveItem={saveItem} keepActionsOpen={activeJobId===item.jobId} views={viewsByJob?.[item.jobId]}/>)}</section>
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
  // 목록에서 상세에 들어가기 전에 조회수를 보여 준다(전체 직무 = 추천 직무도 포함). 조회수만 늦거나 실패해도 목록은 그대로
  const jobViews=useJobViews(eligibility.data?.jobs.map(job=>job.jobId)??[],getJobViews,Boolean(eligibility.data))
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
  const eligibilityByJob=Object.fromEntries(jobs.map(job=>[job.jobId,job]))
  const asOf=round.data?.replay?.defaultAsOf
  const isClosed=(job)=>Boolean(job.closing.closesOn&&asOf&&job.closing.closesOn<=asOf)
  const counts={ALL:summary.total,ELIGIBLE:summary.eligible,NEEDS_CHECK:summary.needsCheck,INELIGIBLE:summary.ineligible}
  const normalizedQuery=appliedSearch.toLowerCase()
  const shown=jobs.filter(job=>(filter==='ALL'||job.verdict===filter)&&(!normalizedQuery||job.title.toLowerCase().includes(normalizedQuery)))

  return <main className="content wide jobs-page jobs-page-ready"><InteractiveCareerBook loggedIn={loggedIn}/><div className="jobs-page-inner"><JobsBanner/><div className="jobs-heading"><PageTitle title={<span className="jobs-title-composed"><span className={`jobs-title-message ${titleMotion}`}>{jobTitlePrefixes[titleIndex]}</span><span className="jobs-title-fixed">찾아보세요</span></span>}/><div className="result-summary"><div><small>추천</small><b>{recommendations.data?.items.length??'–'}</b></div><div><small>지원 가능</small><b>{summary.eligible}</b></div><div><small>확인 필요</small><b>{summary.needsCheck}</b></div><div><small>전체</small><b>{summary.total}</b></div></div></div>
    <div id="recommendations" className="jobs-scroll-anchor"><RecommendationSection recommendations={recommendations} eligibilityByJob={eligibilityByJob} profile={profileBody} label={label} openReason={setRecommendReason} savedIds={savedIds} adding={adding} saveItem={save} activeJobId={saveToast?.jobId} viewsByJob={jobViews.data}/></div>
    <section id="all-jobs" className="card jobs-list"><div className="list-header"><div className="job-list-title"><span>ALL POSITIONS</span><b>전체 직무</b><form className="job-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={event=>setSearchQuery(event.target.value)} placeholder="직무명 검색" aria-label="직무명 검색"/><button type="submit">검색</button></form></div><div className={`job-list-control ${controlsLeaving?'is-leaving':'is-entering'}`}>{appliedSearch?<button type="button" className="show-all-jobs" onClick={showAllJobs}>전체 직무 보기</button>:<div className="filter">{filters.map(([key,name])=><button key={key} className={filter===key?'selected':''} onClick={()=>changeFilter(key)}>{name} <b>{counts[key]}</b></button>)}</div>}</div></div><div className="job-list-columns"><span>직무·기관</span><span>전공 조건</span><span>판정</span><span>모집 상태</span><span>관리</span></div><div className={`job-list-results ${listMotion}`}>
      {saveError&&<p className="notice danger" role="alert">{saveError}</p>}
      {shown.length===0&&<p className="notice">{appliedSearch?`‘${appliedSearch}’가 제목에 포함된 직무가 없어요.`:'이 판정에 해당하는 직무가 없어요.'}</p>}
      {shown.map(job=><div className="job-row" role="link" tabIndex="0" key={job.jobId} onClick={()=>navigate(`/jobs/${job.jobId}`,{state:{returnScrollY:window.scrollY}})} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();navigate(`/jobs/${job.jobId}`,{state:{returnScrollY:window.scrollY}})}}}><div className="job-main"><InstitutionLogo institution={job.institution} compact/><div><b>{job.title}</b><small>{job.institution.name} · {job.team}{viewsText(jobViews.data?.[job.jobId])}</small></div></div><div className="job-major"><Badge>{label('majorMatch',job.majorMatch)}</Badge>{job.alertCount>0&&<DecisionPreview type="document" reasons={job.reasons} count={job.alertCount}><Badge tone="orange">문서 검토</Badge></DecisionPreview>}</div><div>{job.verdict==='NEEDS_CHECK'?<DecisionPreview type="check" reasons={job.reasons}><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge></DecisionPreview>:<Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge>}</div><span className={`job-closing ${isClosed(job)?'is-closed':'is-open'}`}>{isClosed(job)?'마감':job.closing.closesOn?`${formatDay(dayBefore(job.closing.closesOn))} 마감`:'모집 중'}</span><div className="job-actions"><button className={`save-button ${savedIds.includes(job.jobId)?'saved':''}`} disabled={adding!==null||plan.loading} title={savedIds.includes(job.jobId)?'다시 누르면 담기를 취소해요':undefined} onClick={event=>{event.stopPropagation();save(job.jobId)}}>{adding===job.jobId?<i className="save-button-spinner" aria-label="처리 중"/>:savedIds.includes(job.jobId)?'담았어요':'담기'}</button></div></div>)}
    </div></section>
    {recommendReason&&<RecommendationReasonSheet reason={recommendReason} label={label} close={()=>setRecommendReason(null)}/>}
    {saveToast&&<Toast key={saveToast.id} className="first-save-toast" onAnimationEnd={()=>setSaveToast(current=>current?.id===saveToast.id?null:current)}><span className={`first-save-toast-icon ${saveToast.type}`} aria-hidden="true">{saveToast.type==='removed'?'−':'✓'}</span><div><b>{saveToast.message}</b><small>내 지망에서 담은 직무를 확인할 수 있어요.</small></div><Link to="/plan">내 지망 보기</Link></Toast>}
  </div></main>
}
