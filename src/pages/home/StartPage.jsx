import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { getToken, resolveApiAssetUrl } from '../../api/client'
import { getJobViews } from '../../api/jobs'
import { getRecommendationReason, getRecommendations, toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCodes } from '../../api/reference'
import processMascot from '../../assets/images/process-mascot.png'
import jobAnimation from '../../assets/images/job-animation.mp4'
import { useGuestStart } from '../../hooks/useGuestStart'
import { useJobViews } from '../../hooks/useJobViews'
import { useRequest } from '../../hooks/useRequest'
import { RecommendationReasonSheet } from '../jobs/JobsPage'
import { jobs } from '../../mock/jobs'
import './StartPage.css'
import './StartPageProcess.css'

const heroMessages = [
  <>내가 갈 수 있는 현장실습,<br /><em>한눈에 찾다.</em></>,
  <>내 전공으로 시작하는<br /><em>첫 번째 실무 경험.</em></>,
  <>나에게 맞는 현장실습을 찾는<br /><em>가장 쉬운 방법.</em></>,
]

const jobHeadlines = [
  '이런 현장실습을 만나볼 수 있어요',
  '지금, 나에게 맞는 현장실습을 찾아보세요',
]

const recommendedJobHeadlines = [
  '내 정보에 어울리는 추천 현장실습',
  '내 조건에 맞는 현장실습을 지금 만나보세요',
]

const seniorStories = [
  { key: 'the-smc-advertising', category: '광고사업부', title: '더에스엠씨 선배의 실습 이야기', meta: '2025-2 · 광고사업부', activities: ['투썸플레이스 인스타그램 콘텐츠 기획 및 운영', '광고 소재 기획 및 발행', '광고 성과 모니터링, 효과적인 콘텐츠 전략 제안', '광고 소재 기획 및 집행'], outcomes: ['인스타그램을 활용한 디지털 콘텐츠 앵글 구성과 기획', '투썸플레이스 월간 촬영', '엘리베이터 광고와 홍대입구역 OOH 광고 소재를 직접 기획'] },
  { key: 'ovlr-design', category: 'OL디자인실', title: '오뷔엘알 선배의 실습 이야기', meta: '2025-2 · OL디자인실', activities: ['디자인 기획부터 출고까지 전 과정 보조', '업무 우선순위 설정', '디자인 기획, 샘플링, 자재 수급, 출고 사이클 관찰', '공정상 오류나 데드라인 압박 등 다양한 변수 대처 및 프로젝트 지원'], outcomes: [] },
  { key: 'champstudy-production', category: '강의제작팀', title: '챔프스터디 선배의 실습 이야기', meta: '2024-1 · 강의제작팀', activities: ['촬영자료(PPT) 제작 및 검수', '강의 검수', '학습자료 제작', '샘플 강의 / 홍보영상 선정', '목차 작업 / 오픈 작업', '강의의 CS 관련 작업이나 수정 작업 등 기타 작업', '공모전 참여'], outcomes: ['많은 강의를 담당하여 오픈을 진행'] },
  { key: 'soseo-logistics', category: '물류팀', title: '소서 선배의 실습 이야기', meta: '2025-1 · 물류팀', activities: ['내부재고 관리, 물류창고 재고, 이동중인 재고, 해외재고 관리', '수출 준비 참여', '인터넷 판매건 출고시키기', '물류비 절감 방안 생각', '물류비 기록', '해외로 보내지는 물류비들이 오차가 없는지 비교하기 위해', '모든 물류비를 기록하고 영수증과 비교함'], outcomes: ['해외 운송비를 절반 이상 줄일 수 있는 방안을 직접 조사하고 PPT로 제안'] },
  { key: 'wearefriends-content', category: '콘텐츠팀', title: '위아프렌즈 선배의 실습 이야기', meta: '2025-2 · 콘텐츠팀', activities: ['외국인들을 위한 콘텐츠 제작 보조', '행사 진행을 위한 사무 보조', '정기 콘텐츠 업로드를 위한 제작 보조', '신규 서비스 런칭/진행을 위한 업무 보조'], outcomes: ['서울관광재단 협업 프로젝트와 K-Xplore 신규 서비스 런칭에 참여'] },
  { key: 'smith-marketing', category: '마케팅솔루션팀', title: '스미스 선배의 실습 이야기', meta: '2025-2 · 마케팅솔루션팀', activities: ['굿즈 및 팝업스토어, 축제디자인', '촬영 및 사업 보조', '행사 및 팝업스토어 운영', '버스킹 운영 및 공연 현장 보조'], outcomes: ['굿즈 디자인, 팝업스토어, 행사 운영, 촬영 보조 등 다양한 업무를 수행'] },
  { key: 'deltatech-business', category: '사업부', title: '델타텍코리아 선배의 실습 이야기', meta: '2025-2 · 사업부', activities: ['거래 제의서, 피치덱 등 영업 문서 작성 및 발송', '전시회/박람회 참가 및 해외 기업 B2B 미팅', '관심 기업 대상 화상회의 알선 및 통역', '기술 실증 데이터 클러스터 분석 및 보고서 작성'], outcomes: ['총 6개의 프로젝트에 참여', '2개 프로젝트에서는 프로젝트 매니저로서 용역 계약부터 완료 단계까지 전 과정을 담당', '기술 실증 관련 군집분석 보고서 작성'] },
  { key: 'building-doctor-safety', category: '안전진단팀', title: '빌딩닥터엔지니어링 선배의 실습 이야기', meta: '2024-2 · 안전진단팀', activities: ['어린이집 건축물 안전진단 후 결함 위치 도면 그리기 및 결과보고서 작성', 'OOO 건축물 외관 그리기 작업', '건축물 외관 조사 부록 정리, 결과표 정리', '건축물 보수작업에 필요한 재료 조사', 'MIDAS 프로그램 배우고 활용하기', '그 외 자료 및 보고서 정리 등'], outcomes: [] },
]

function StoryDetailSheet({ story, close }) {
  const panelRef=useRef(null)
  const dragState=useRef({active:false,startY:0,offset:0})
  const closeTimer=useRef(null)
  const closingRef=useRef(false)
  const [closing,setClosing]=useState(false)
  const requestClose=useCallback(()=>{
    if(closingRef.current)return
    closingRef.current=true
    setClosing(true)
    closeTimer.current=window.setTimeout(close,360)
  },[close])
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const closeOnEscape=(event)=>{if(event.key==='Escape')requestClose()}
    document.body.style.overflow='hidden'
    window.addEventListener('keydown',closeOnEscape)
    return()=>{window.clearTimeout(closeTimer.current);document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape)}
  },[requestClose])
  const startDrag=(event)=>{
    if(closing||event.target.closest('button'))return
    dragState.current={active:true,startY:event.clientY,offset:0}
    event.currentTarget.setPointerCapture(event.pointerId)
    panelRef.current?.classList.add('is-dragging','has-dragged')
  }
  const moveDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    const offset=Math.max(-90,event.clientY-dragState.current.startY)
    dragState.current.offset=offset
    panelRef.current.style.transform=`translateY(${offset}px)`
  }
  const endDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    dragState.current.active=false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const panel=panelRef.current
    panel.classList.remove('is-dragging')
    panel.style.setProperty('--story-sheet-drag-y',`${dragState.current.offset}px`)
    if(dragState.current.offset>=panel.getBoundingClientRect().height*.2){requestClose();return}
    panel.classList.add('is-settling')
    panel.style.transform='translateY(0)'
    panel.style.setProperty('--story-sheet-drag-y','0px')
    window.setTimeout(()=>panel.classList.remove('is-settling'),300)
  }
  return createPortal(<div className={`story-detail-overlay ${closing?'is-closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}><section ref={panelRef} className="story-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="story-detail-title" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><span className="story-detail-grip" aria-hidden="true"/><button type="button" className="story-detail-close" aria-label="닫기" onClick={requestClose}>×</button><div className="story-detail-heading"><span>{story.category}</span><h2 id="story-detail-title">{story.title}</h2><p>{story.meta}</p></div><div className="story-detail-columns"><section><h3>실습 내용</h3>{story.activities.length?<ul>{story.activities.map(activity=><li key={activity}>{activity}</li>)}</ul>:<p>기록된 실습 내용이 없어요.</p>}</section><section><h3>실습 결과</h3>{story.outcomes.length?<ul>{story.outcomes.map(outcome=><li key={outcome}>{outcome}</li>)}</ul>:<p>기록된 실습 결과가 없어요.</p>}</section></div>{story.source&&<small className="story-detail-source">{story.source}</small>}</section></div>,document.body)
}

const storyFilmTopImages = [
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',
]

const storyFilmBottomImages = [
  'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=900&q=80',
]

const jobSummaries = {
  'beauty-marketing': '브랜드의 SNS 콘텐츠와 캠페인 운영을 함께 경험해요.',
  'package-design': '제품 패키지 제작 과정과 디자인 실무를 배워요.',
  'product-assistant': '상품 아이디어를 정리하고 기획 업무를 보조해요.',
  'customer-experience': '고객이 브랜드를 만나는 경험을 더 좋게 만들어요.',
}

// 프로필·추천 결과는 브라우저 저장소에 남기지 않고, 현재 앱 세션의 메모리에만 보관한다.
// 같은 계정으로 홈에 다시 돌아오면 API를 반복 호출하지 않고 직전 추천을 바로 보여 준다.
let homeRecommendationCache = { token: null, data: null }

function HomeInstitutionLogo({ institution }) {
  const [failedSource,setFailedSource]=useState(null)
  const source=resolveApiAssetUrl(institution.logoPath)
  const fallback=(institution.name?.trim()?.[0]??'기').toUpperCase()
  return <span className="home-institution-logo">{source&&source!==failedSource?<img src={source} alt={`${institution.name} 로고`} onError={()=>setFailedSource(source)}/>:<b aria-hidden="true">{fallback}</b>}</span>
}

function useCachedHomeRecommendations() {
  const token = getToken()
  const cached = token && homeRecommendationCache.token === token ? homeRecommendationCache.data : null
  const [result, setResult] = useState(() => ({ token, data: cached }))

  useEffect(() => {
    if (!token || (homeRecommendationCache.token === token && homeRecommendationCache.data)) return undefined

    const controller = new AbortController()
    const load = async () => {
      try {
        const [profile, codes] = await Promise.all([getMyProfile(controller.signal), getCodes(controller.signal)])
        const recommendations = await getRecommendations(toProfileBody(profile), controller.signal)
        const data = { recommendations, codes, profile }
        homeRecommendationCache = { token, data }
        setResult({ token, data })
      } catch (error) {
        if (error.name !== 'AbortError') setResult({ token, data: null })
      }
    }
    load()
    return () => controller.abort()
  }, [token])

  return result.token === token ? result.data : cached
}

export function StartPage() {
  const navigate = useNavigate()
  const { start: startGuest, loadingRole, error: guestError } = useGuestStart()
  const loggedIn = Boolean(getToken())
  const homeRecommendationData = useCachedHomeRecommendations()
  const recommendedJobs = useMemo(()=>homeRecommendationData?.recommendations.items?.slice(0,4)??[],[homeRecommendationData])
  const label = (group, value) => homeRecommendationData?.codes?.[group]?.[value] ?? value
  const activeJobHeadlines = recommendedJobs.length > 0 ? recommendedJobHeadlines : jobHeadlines
  const homeJobs = recommendedJobs.length > 0 ? recommendedJobs.map(item => ({
    id: item.jobId,
    company: item.institution.name,
    institution: item.institution,
    title: item.title,
    description: `${label('jobType', item.jobType)}${item.stipend?.amount ? ` · ${label('stipendBasis', item.stipend.basis)} ${item.stipend.amount.toLocaleString('ko-KR')}원` : ''}`,
    verdict: label('verdict', item.verdict),
    fit: label('fit', item.fit),
    verdictCode: item.verdict,
    fitCode: item.fit,
    reasonStatus: item.reasonStatus,
    reasonTemplate: item.reasonTemplate,
    citations: item.citations,
  })) : jobs.slice(0, 4).map(job => ({ ...job, institution: { name: job.company, logoPath: job.logoPath }, description: jobSummaries[job.id], verdictCode: job.verdict, fitCode: job.fit, reasonTemplate: jobSummaries[job.id], citations: [] }))
  const jobViews = useJobViews(homeJobs.map(job => job.id), getJobViews, loggedIn)
  const plan = useRequest(getMyPlan, Boolean(homeRecommendationData))
  const [addedJobIds, setAddedJobIds] = useState([])
  const [removedJobIds, setRemovedJobIds] = useState([])
  const [addingJobId, setAddingJobId] = useState(null)
  const [cardMessage, setCardMessage] = useState('')
  const [recommendReason, setRecommendReason] = useState(null)
  const savedJobIds = [...(plan.data?.items.map(item => item.jobId) ?? []), ...addedJobIds].filter(id => !removedJobIds.includes(id))
  const saveHomeJob = async (jobId) => {
    if (!loggedIn) {
      navigate('/login')
      return
    }
    if (addingJobId !== null) return
    const isSaved = savedJobIds.includes(jobId)
    setAddingJobId(jobId)
    setCardMessage('')
    try {
      if (isSaved) {
        await removePlanItem(jobId)
        setRemovedJobIds(current => [...current, jobId])
        setAddedJobIds(current => current.filter(id => id !== jobId))
      } else {
        await addPlanItem(jobId)
        setAddedJobIds(current => [...current, jobId])
        setRemovedJobIds(current => current.filter(id => id !== jobId))
      }
    } catch (error) {
      setCardMessage(planErrorMessage(error, isSaved ? '빼기' : '담기'))
    } finally {
      setAddingJobId(null)
    }
  }
  const openHomeReason = async (job) => {
    const selected = { ...job, jobId: job.id, verdict: job.verdictCode, fit: job.fitCode }
    setRecommendReason(selected)
    if (job.reasonStatus !== 'PENDING' || !homeRecommendationData?.profile) return
    try {
      const reason = await getRecommendationReason(job.id, toProfileBody(homeRecommendationData.profile))
      setRecommendReason(current => current?.jobId === job.id ? { ...current, reasonTemplate: reason.text, citations: reason.citations } : current)
    } catch {
      // API가 늦거나 실패하면 추천 응답에 포함된 기본 문장을 그대로 보여 준다.
    }
  }
  const processSectionRef = useRef(null)
  const jobsSectionRef = useRef(null)
  const storiesSectionRef = useRef(null)
  const ctaSectionRef = useRef(null)
  const animationVideoRef = useRef(null)
  const animationReplayTimer = useRef(null)
  const animationInViewRef = useRef(false)
  const storiesListRef = useRef(null)
  const storyDragRef = useRef({ startX: 0, startScrollLeft: 0, active: false })
  const storyDragMovedRef = useRef(false)
  const storyDirectionRef = useRef(-1)
  const storiesAutoStartedRef = useRef(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [isProcessVisible, setIsProcessVisible] = useState(false)
  const [isJobsVisible, setIsJobsVisible] = useState(false)
  const [areJobsSettled, setAreJobsSettled] = useState(false)
  const [isStoriesVisible, setIsStoriesVisible] = useState(false)
  const [isCtaVisible, setIsCtaVisible] = useState(false)
  const [isStoriesDragging, setIsStoriesDragging] = useState(false)
  const [selectedStory, setSelectedStory] = useState(null)
  const [jobHeadlineIndex, setJobHeadlineIndex] = useState(0)
  const [isJobHeadlineFading, setIsJobHeadlineFading] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsFading(true)
      window.setTimeout(() => {
        setMessageIndex(current => (current + 1) % heroMessages.length)
        setIsFading(false)
      }, 850)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let changeTimer
    const timer = window.setInterval(() => {
      setIsJobHeadlineFading(true)
      changeTimer = window.setTimeout(() => {
        setJobHeadlineIndex(current => (current + 1) % jobHeadlines.length)
        setIsJobHeadlineFading(false)
      }, 700)
    }, 7000)
    return () => {
      window.clearInterval(timer)
      if (changeTimer !== undefined) window.clearTimeout(changeTimer)
    }
  }, [])

  useEffect(() => {
    const observe = (section, reveal, threshold = 0.16) => {
      if (!section) return undefined
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          reveal()
          observer.disconnect()
        }
      }, { threshold })
      observer.observe(section)
      return () => observer.disconnect()
    }

    const stopObservingJobs = observe(jobsSectionRef.current, () => setIsJobsVisible(true))
    const stopObservingStories = observe(storiesSectionRef.current, () => setIsStoriesVisible(true), 0.45)
    const stopObservingCta = observe(ctaSectionRef.current, () => setIsCtaVisible(true), 0.18)
    return () => {
      stopObservingJobs?.()
      stopObservingStories?.()
      stopObservingCta?.()
    }
  }, [])

  useEffect(() => {
    if (!isJobsVisible) return undefined
    const timer = window.setTimeout(() => setAreJobsSettled(true), 1200)
    return () => window.clearTimeout(timer)
  }, [isJobsVisible])

  useEffect(() => () => {
    if (animationReplayTimer.current !== null) window.clearTimeout(animationReplayTimer.current)
  }, [])

  const playGreeting = useCallback(function playGreeting() {
    if (!animationInViewRef.current) return
    const video = animationVideoRef.current
    if (!video) return
    if (animationReplayTimer.current !== null) window.clearTimeout(animationReplayTimer.current)
    video.currentTime = 0
    void video.play().catch(() => {})
    animationReplayTimer.current = window.setTimeout(playGreeting, 20000)
  }, [])

  const startStoryDrag = (event) => {
    const list = storiesListRef.current
    if (!list) return
    storyDragRef.current = { startX: event.clientX, startScrollLeft: list.scrollLeft, active: true }
    storyDragMovedRef.current = false
  }

  const moveStoryDrag = (event) => {
    if (!storyDragRef.current.active || !storiesListRef.current) return
    if(Math.abs(event.clientX-storyDragRef.current.startX)<=5)return
    storyDragMovedRef.current=true
    setIsStoriesDragging(true)
    storiesListRef.current.scrollLeft = storyDragRef.current.startScrollLeft - (event.clientX - storyDragRef.current.startX)
  }

  const stopStoryDrag = () => {
    storyDragRef.current.active=false
    setIsStoriesDragging(false)
  }

  useEffect(() => {
    const video = animationVideoRef.current
    if (!video) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      animationInViewRef.current = entry.isIntersecting
      if (entry.isIntersecting) {
        playGreeting()
        return
      }

      video.pause()
      if (animationReplayTimer.current !== null) window.clearTimeout(animationReplayTimer.current)
    }, { threshold: 0.45 })

    observer.observe(video)
    return () => observer.disconnect()
  }, [playGreeting])

  useEffect(() => {
    const section = processSectionRef.current
    if (!section) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsProcessVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.2 })

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const list = storiesListRef.current
    if (!isStoriesVisible || isStoriesDragging || selectedStory || !list) return undefined
    if(!storiesAutoStartedRef.current){
      list.scrollLeft=Math.max(0,list.scrollWidth-list.clientWidth)
      storyDirectionRef.current=-1
      storiesAutoStartedRef.current=true
    }
    let frame
    let previousTime
    const slideContinuously=(time)=>{
      if(previousTime!==undefined){
        const maxScroll=Math.max(0,list.scrollWidth-list.clientWidth)
        let next=list.scrollLeft+storyDirectionRef.current*Math.min(time-previousTime,32)*0.04
        if(next<=0){next=0;storyDirectionRef.current=1}
        if(next>=maxScroll){next=maxScroll;storyDirectionRef.current=-1}
        list.scrollLeft=next
      }
      previousTime=time
      frame=window.requestAnimationFrame(slideContinuously)
    }
    frame=window.requestAnimationFrame(slideContinuously)
    return()=>window.cancelAnimationFrame(frame)
  },[isStoriesDragging,isStoriesVisible,selectedStory])

  return <main className="landing home-landing">
    <section className="home-hero"><div className="home-hero-content"><div className="hero"><span className="eyebrow">학교 밖에서, 내 일을 먼저 만나보세요</span><h1 key={messageIndex} className={`hero-message ${isFading ? 'is-fading' : ''}`}>{heroMessages[messageIndex]}</h1><div className="button-row">{loggedIn?<Link className="button hero-jobs-button" to="/jobs">직무 찾아보기</Link>:<><Link className="button primary" to="/login">로그인·가입으로 시작</Link><button type="button" className="button glass-button" disabled={loadingRole!==null} onClick={() => startGuest('STUDENT')}>{loadingRole==='STUDENT' ? '체험 계정 만드는 중…' : '예시 프로필로 시작'}</button></>}</div>{!loggedIn&&guestError && <p className="guest-error" role="alert">{guestError}</p>}{!loggedIn&&loadingRole && <p className="guest-wait">서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>}</div></div><Link className="center-link" to="/center">센터 담당자로 보기 →</Link><button className="scroll-cue" onClick={() => processSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><span>아래로 살펴보기</span><b>↓</b></button></section>
    <section className={`home-process ${isProcessVisible ? 'is-visible' : ''}`} ref={processSectionRef}>
      <div className="process-layout">
        <div className="process-copy">
          <div className="process-intro">
            <p className="process-kicker">현장실습을 시작하는 가장 가까운 곳</p>
            <p>현장뛰자는 전공과 학년을 바탕으로 지원할 수 있는 현장실습을 찾고, 공고 원문 근거를 확인하며, 관심 있는 직무를 1~3지망으로 정리할 수 있도록 돕는 서비스입니다. 복잡하게 흩어진 현장실습 준비를 한곳에서 더 분명하게 시작해 보세요.</p>
          </div>
          <div className="process-guide">
            <div className="process-heading"><h3>세 단계면 준비가 끝나요</h3></div>
            <div className="steps">{[['01','프로필 입력','전공·학년·이수 학기만 간단히'],['02','지원 가능 확인','학교 규정과 공고 조건을 함께'],['03','1~3지망 정리','모집 신호와 빈 자리까지 한눈에']].map(([n,t,d])=><div className="process-step" key={n}><b>{n}</b><h4>{t}</h4><p>{d}</p></div>)}</div>
          </div>
        </div>
        <div className="process-image"><img src={processMascot} alt="책상 앞에서 현장실습을 준비하는 마스코트" /></div>
      </div>
    </section>
    <section className={`home-jobs ${isJobsVisible ? 'is-visible' : ''} ${areJobsSettled ? 'is-settled' : ''}`} ref={jobsSectionRef}>
      <div className="home-jobs-layout">
        <div className="job-animation-slot" onClick={playGreeting} role="button" tabIndex={0} aria-label="클릭하면 마스코트가 인사합니다">
          <video ref={animationVideoRef} muted playsInline preload="auto" aria-hidden="true">
            <source src={jobAnimation} type="video/mp4" />
          </video>
        </div>
        <div className="home-jobs-content">
          <div className="home-section-heading">
            <h2 className={`job-title-message ${isJobHeadlineFading ? 'is-fading' : ''}`}>{activeJobHeadlines[jobHeadlineIndex]}</h2>
          </div>
          {cardMessage && <p className="home-job-message" role="alert">{cardMessage}</p>}
          <div className="home-job-list">{homeJobs.map(job => {
            const saved = savedJobIds.includes(job.id)
            const views = jobViews.data?.[job.id]
            return <article className="home-job-row" role="link" tabIndex="0" key={job.id} onClick={() => navigate(`/jobs/${job.id}`, { state: { returnScrollY: window.scrollY } })} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); navigate(`/jobs/${job.id}`, { state: { returnScrollY: window.scrollY } }) } }}>
              <div><div className="home-job-company"><HomeInstitutionLogo institution={job.institution}/><div className="home-job-company-info"><div className="home-job-badges"><span className={job.verdict === '지원 가능' ? 'is-available' : 'is-check'}>{job.verdict}</span><span>적합도 {job.fit}</span></div><small>{job.company}</small></div></div><h3>{job.title}</h3><p className="job-description">{job.description}</p><div className="job-meta"><span>{views ? `조회 ${views.views.toLocaleString('ko-KR')}` : '조회수 집계 중'}</span></div><div className="home-job-actions recommend-card-bottom"><button type="button" className="reason-button" onClick={event => { event.stopPropagation(); openHomeReason(job) }}>추천 이유 보기</button><button type="button" className={`recommend-save-button ${saved ? 'saved' : ''}`} disabled={addingJobId === job.id} title={saved ? '다시 누르면 담기를 취소해요' : undefined} onClick={event => { event.stopPropagation(); saveHomeJob(job.id) }}>{addingJobId === job.id ? <i className="save-button-spinner" aria-label="처리 중"/> : saved ? '담았어요' : '담기'}</button></div></div>
            </article>
          })}</div>
        </div>
      </div>
      <Link to="/jobs" className="section-more">현장실습 전체 보기 <span aria-hidden="true">→</span></Link>
      {recommendReason && <RecommendationReasonSheet reason={recommendReason} label={label} close={() => setRecommendReason(null)}/>}
    </section>
    <section className={`home-stories ${isStoriesVisible ? 'is-visible' : ''}`} ref={storiesSectionRef}>
      <div className="story-film" aria-hidden="true">
        <div className="story-film-row story-film-row-top"><div className="story-film-track">{Array.from({length:4},()=>storyFilmTopImages).flat().map((image, index) => <img src={image} key={`${image}-${index}`} alt="" />)}</div></div>
        <div className="story-film-row story-film-row-bottom"><div className="story-film-track">{Array.from({length:4},()=>storyFilmBottomImages).flat().map((image, index) => <img src={image} key={`${image}-${index}`} alt="" />)}</div></div>
      </div>
      <div className="home-stories-inner">
        <div className="home-section-heading story-heading"><div><h2>현장실습은 어떤 하루일까요?</h2><p className="story-subtitle">먼저 다녀온 선배들의 이야기를 들어보세요</p></div><span>실습을 먼저 경험한 선배들의 기록을 만나보세요.</span></div>
        <div className="story-carousel"><div ref={storiesListRef} className={`story-list ${isStoriesDragging ? 'is-dragging' : ''}`} onPointerDown={startStoryDrag} onPointerMove={moveStoryDrag} onPointerUp={stopStoryDrag} onPointerCancel={stopStoryDrag}>
          {seniorStories.map(story => <article className="story-card" role="button" tabIndex="0" key={story.key} onClick={()=>{if(storyDragMovedRef.current){storyDragMovedRef.current=false;return}if(!loggedIn){navigate('/login');return}setSelectedStory(story)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!loggedIn){navigate('/login');return}setSelectedStory(story)}}}>
            <span>{story.category}</span><h3>{story.title}</h3>{loggedIn&&<ul className="story-card-preview">{story.activities.slice(0,2).map(activity=><li key={activity}>{activity}</li>)}</ul>}<p className="story-card-meta">{loggedIn?story.meta:'로그인 후 확인하세요'}</p>
          </article>)}
        </div></div>
      </div>
      {selectedStory&&<StoryDetailSheet story={selectedStory} close={()=>setSelectedStory(null)}/>}
    </section>
    <section className={`home-cta ${isCtaVisible ? 'is-visible' : ''}`} ref={ctaSectionRef}>
      <div className="home-cta-content"><h2>지금 바로 신청하세요</h2><Link className="button primary" to={loggedIn ? '/jobs' : '/login'}>{loggedIn ? '직무 찾아보기' : '신청하기'}</Link></div>
    </section>
  </main>
}
