import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import processMascot from '../../assets/images/process-mascot.png'
import jobAnimation from '../../assets/images/job-animation.mp4'
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

const seniorStories = [
  { category: '마케팅', title: '처음 맡은 브랜드 콘텐츠, 이렇게 시작했어요', meta: '현장실습 6주 차 · 콘텐츠 마케팅' },
  { category: '디자인', title: '디자인 실습에서 배운 협업의 순서', meta: '현장실습 수료 · 패키지 디자인' },
  { category: '기획', title: '막막했던 첫 주를 지나, 일을 내 것으로 만든 방법', meta: '현장실습 4주 차 · 상품 기획' },
  { category: '운영', title: '고객과 가장 가까운 자리에서 배운 작은 디테일', meta: '현장실습 5주 차 · 고객 경험 운영' },
  { category: '콘텐츠', title: '회의에서 내 의견을 꺼내기까지의 기록', meta: '현장실습 수료 · 비주얼 콘텐츠' },
  { category: '기획', title: '실무자에게 질문하는 법을 배운 첫 프로젝트', meta: '현장실습 3주 차 · 상품 기획' },
]

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

export function StartPage() {
  const processSectionRef = useRef(null)
  const jobsSectionRef = useRef(null)
  const storiesSectionRef = useRef(null)
  const animationVideoRef = useRef(null)
  const animationReplayTimer = useRef(null)
  const animationInViewRef = useRef(false)
  const storiesListRef = useRef(null)
  const storyDragRef = useRef({ startX: 0, startScrollLeft: 0 })
  const storyResetTimer = useRef(null)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isFading, setIsFading] = useState(false)
  const [isProcessVisible, setIsProcessVisible] = useState(false)
  const [isJobsVisible, setIsJobsVisible] = useState(false)
  const [isStoriesVisible, setIsStoriesVisible] = useState(false)
  const [isStoriesDragging, setIsStoriesDragging] = useState(false)
  const [isStoriesHovered, setIsStoriesHovered] = useState(false)
  const [hasStoriesAutoFinished, setHasStoriesAutoFinished] = useState(false)
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
    return () => {
      stopObservingJobs?.()
      stopObservingStories?.()
    }
  }, [])

  useEffect(() => () => {
    if (animationReplayTimer.current !== null) window.clearTimeout(animationReplayTimer.current)
    if (storyResetTimer.current !== null) window.clearTimeout(storyResetTimer.current)
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
    storyDragRef.current = { startX: event.clientX, startScrollLeft: list.scrollLeft }
    setIsStoriesDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveStoryDrag = (event) => {
    if (!isStoriesDragging || !storiesListRef.current) return
    storiesListRef.current.scrollLeft = storyDragRef.current.startScrollLeft - (event.clientX - storyDragRef.current.startX)
  }

  const stopStoryDrag = () => setIsStoriesDragging(false)

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
    if (!isStoriesVisible || isStoriesDragging || isStoriesHovered || hasStoriesAutoFinished || !list) return undefined

    const slideOneCard = () => {
      const card = list.querySelector('.story-card')
      if (!card) return
      const gap = Number.parseFloat(window.getComputedStyle(list).gap) || 0
      const lastPosition = list.scrollWidth - list.clientWidth
      const nextPosition = Math.min(list.scrollLeft + card.offsetWidth + gap, lastPosition)
      list.scrollTo({ left: nextPosition, behavior: 'smooth' })

      if (nextPosition >= lastPosition - 1) {
        setHasStoriesAutoFinished(true)
        storyResetTimer.current = window.setTimeout(() => {
          list.scrollTo({ left: 0, behavior: 'smooth' })
        }, 850)
      }
    }

    const timer = window.setInterval(slideOneCard, 5000)
    return () => window.clearInterval(timer)
  }, [hasStoriesAutoFinished, isStoriesDragging, isStoriesHovered, isStoriesVisible])

  return <main className="landing home-landing">
    <section className="home-hero"><div className="home-hero-content"><div className="hero"><span className="eyebrow">학교 밖에서, 내 일을 먼저 만나보세요</span><h1 className={`hero-message ${isFading ? 'is-fading' : ''}`}>{heroMessages[messageIndex]}</h1><div className="button-row"><Link className="button primary" to="/profile">예시 프로필로 시작</Link><Link className="button glass-button" to="/login">로그인·가입으로 시작</Link></div></div></div><Link className="center-link" to="/center">센터 담당자료 보기 →</Link><button className="scroll-cue" onClick={() => processSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}><span>아래로 살펴보기</span><b>↓</b></button></section>
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
            <Link className="button primary process-action" to="/login">지금 시작하기</Link>
          </div>
        </div>
        <div className="process-image"><img src={processMascot} alt="책상 앞에서 현장실습을 준비하는 마스코트" /></div>
      </div>
    </section>
    <section className={`home-jobs ${isJobsVisible ? 'is-visible' : ''}`} ref={jobsSectionRef}>
      <div className="home-jobs-layout">
        <div className="job-animation-slot" onClick={playGreeting} role="button" tabIndex={0} aria-label="클릭하면 마스코트가 인사합니다">
          <video ref={animationVideoRef} muted playsInline preload="auto" aria-hidden="true">
            <source src={jobAnimation} type="video/mp4" />
          </video>
        </div>
        <div className="home-jobs-content">
          <div className="home-section-heading">
            <h2 className={`job-title-message ${isJobHeadlineFading ? 'is-fading' : ''}`}>{jobHeadlines[jobHeadlineIndex]}</h2>
          </div>
          <div className="home-job-list"><span className="popular-top">인기 TOP 4</span>{jobs.slice(0, 4).map(job => <Link className="home-job-row" to={`/jobs/${job.id}`} key={job.id}>
            <div><h3>{job.title}</h3><p className="job-description">{jobSummaries[job.id]}</p><div className="job-meta"><span>{job.company}</span><span>{job.location}</span></div></div>
          </Link>)}</div>
          <Link to="/jobs" className="section-more">현장실습 전체 보기 →</Link>
        </div>
      </div>
    </section>
    <section className={`home-stories ${isStoriesVisible ? 'is-visible' : ''}`} ref={storiesSectionRef}>
      <div className="story-film" aria-hidden="true">
        <div className="story-film-row story-film-row-top"><div className="story-film-track">{[...storyFilmTopImages, ...storyFilmTopImages].map((image, index) => <img src={image} key={`${image}-${index}`} alt="" />)}</div></div>
        <div className="story-film-row story-film-row-bottom"><div className="story-film-track">{[...storyFilmBottomImages, ...storyFilmBottomImages].map((image, index) => <img src={image} key={`${image}-${index}`} alt="" />)}</div></div>
      </div>
      <div className="home-stories-inner">
        <div className="home-section-heading story-heading"><div><h2>현장실습은 어떤 하루일까요?</h2><p className="story-subtitle">먼저 다녀온 선배들의 이야기를 들어보세요</p></div><span>실습을 먼저 경험한 선배들의 솔직한 기록을 만나보세요.</span></div>
        <div className="story-carousel" onMouseEnter={() => setIsStoriesHovered(true)} onMouseLeave={() => setIsStoriesHovered(false)}><div ref={storiesListRef} className={`story-list ${isStoriesDragging ? 'is-dragging' : ''}`} onPointerDown={startStoryDrag} onPointerMove={moveStoryDrag} onPointerUp={stopStoryDrag} onPointerCancel={stopStoryDrag}>
          {seniorStories.map(story => <article className="story-card" key={story.title}>
            <h3>{story.title}</h3><p>{story.meta}</p><b>자세히 보기 →</b>
          </article>)}
        </div></div>
      </div>
    </section>
    <section className="home-cta">
      <div className="home-cta-content"><h2>지금 바로 신청하세요</h2><Link className="button primary" to="/login">신청하기</Link></div>
    </section>
  </main>
}
