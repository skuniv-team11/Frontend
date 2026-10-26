import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getMyExplore } from '../../api/explore'
import { getEligibility } from '../../api/jobs'
import { addPlanItem, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCurrentRound, label } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, Toast } from '../../components/Shell'
import { InstitutionLogo, VerdictBadge } from '../../components/v2'
import { useGuestStart } from '../../hooks/useGuestStart'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, MAJOR_LABEL } from '../../lib/format'
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
import './JobDetailPage.css'
import './JobsV2.css'

// 직무 찾기(S2+S3) — 판정 목록 #14 · 위쪽 추천 = 직무 탐색 결과 #30 · 담기/빼기 #20/#21
const FILTERS = [['ALL', '전체'], ['ELIGIBLE', '지원 가능'], ['NEEDS_CHECK', '확인 필요'], ['INELIGIBLE', '지원 불가']]
const TITLE_PREFIXES = ['나에게 맞는 직무를 여기서', '관심 분야와 가까운 직무를', '지원할 수 있는 현장실습을']
const SHOW = 12

// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(legacy 규칙 그대로)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
// 모집 판정 기준일(README '기준일'): 리플레이 중이면 rounds/current의 replay.defaultAsOf, 아니면 오늘
const judgeDate = (round) => round?.replay?.defaultAsOf ?? todayKst()
// 마감 = closesOn ≤ 기준일 이거나, 기준일이 회차 모집 종료일 뒤
const isClosed = (closing, round) => {
  if (!round) return false
  const asOf = judgeDate(round)
  if (closing?.closesOn && closing.closesOn <= asOf) return true
  return Boolean(round.recruitEnd && asOf > round.recruitEnd)
}
const closingText = (closing, round) => isClosed(closing, round) ? '마감' : closing?.closesOn ? `${fmtDate(dayBefore(closing.closesOn))} 마감${closing.closesOnIsVirtual ? '(가상)' : ''}` : '모집 중'
const shorten = (text, max) => {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}

const loadEligibility = (signal) => getEligibility(signal)
const loadExplore = (signal) => getMyExplore(signal)
const loadRound = (signal) => getCurrentRound(signal)

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

// 왼쪽에 꽂힌 진로 안내 책(옛 화면 그대로) — 1초 올려 두면 펼쳐진다
function InteractiveCareerBook({ loggedIn }) {
  const [active, setActive] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const hoverTimer = useRef(null)
  const pulseTimer = useRef(null)
  const cancelHover = () => window.clearTimeout(hoverTimer.current)
  const startHover = () => {
    cancelHover()
    if (!active) {
      setPeeking(true)
      hoverTimer.current = window.setTimeout(() => setActive(true), 1000)
    }
  }
  const leaveBook = () => { cancelHover(); if (!active) setPeeking(false) }
  const closeBook = useCallback(() => {
    window.clearTimeout(hoverTimer.current); window.clearTimeout(pulseTimer.current)
    setActive(false); setPeeking(false); setRevealed(false); setPulsing(false)
  }, [])
  const openBook = () => {
    if (!active) { cancelHover(); setPeeking(true); setActive(true); return }
    window.clearTimeout(pulseTimer.current)
    setRevealed(false)
    setPulsing(true)
    pulseTimer.current = window.setTimeout(() => { setPulsing(false); setRevealed(true) }, 450)
  }
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') closeBook() }
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.clearTimeout(hoverTimer.current); window.clearTimeout(pulseTimer.current); window.removeEventListener('keydown', closeOnEscape) }
  }, [closeBook])
  useEffect(() => {
    if (!active) return undefined
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [active])
  return <>
    {active && <button type="button" className="career-book-backdrop" aria-label="책 닫기" onClick={closeBook} />}
    {active && <div className="career-book-active-copy"><p>{loggedIn ? <><span>합격한 선배들의</span><br />자소서 꿀팁을 받아가세요.</> : <><span>로그인 후 합격한 선배들의</span><br />자소서 꿀팁을 받아가세요.</>}</p><button type="button" className="career-book-dismiss" aria-label="책 닫기" onClick={closeBook}>×</button></div>}
    {!active && <span className={`career-book-hint ${peeking ? 'is-peeking' : ''}`}>마우스를<br />올려보세요<img src={mirroredLoopArrow} alt="" aria-hidden="true" /></span>}
    <button type="button" className={`career-book-trigger ${peeking ? 'is-peeking' : ''} ${active ? 'is-active' : ''} ${pulsing ? 'is-pulsing' : ''}`} aria-expanded={active} aria-label={active ? '합격 자소서 팁 확인하기' : '1초 동안 마우스를 올려 책 펼쳐 보기'} onMouseEnter={startHover} onMouseLeave={leaveBook} onFocus={startHover} onBlur={leaveBook} onClick={openBook}>
      <span className="career-book-hit-area" aria-hidden="true" />
      <img src={careerBook} alt="현장실습 진로 안내 책" />
    </button>
    {active && revealed && <p className="career-book-empty" role="status">아직 데이터가 없어요.</p>}
  </>
}

// 위쪽 배너 슬라이드(옛 화면 그대로) — 4초마다 넘어가고, 누르면 그 직무 상세로
function JobsBanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const [active, setActive] = useState(() => Number.isInteger(location.state?.jobsBannerIndex) ? location.state.jobsBannerIndex : 0)
  const [paused, setPaused] = useState(false)
  const banners = useMemo(() => [...arrangedJobBanners.map((banner) => ({ kind: 'job', ...banner })), { kind: 'promo', key: 'service-promo', image: coopRadarCareerBanner }], [])
  useEffect(() => {
    if (paused || banners.length < 2) return undefined
    const timer = window.setInterval(() => setActive((current) => (current + 1) % banners.length), 4000)
    return () => window.clearInterval(timer)
  }, [paused, banners.length])
  const move = (direction) => setActive((current) => (current + direction + banners.length) % banners.length)
  const openBanner = (banner) => {
    if (banner.kind !== 'job') { navigate('/explore'); return }
    window.history.replaceState({ ...window.history.state, usr: { ...(window.history.state?.usr ?? {}), jobsBannerIndex: active } }, '')
    navigate(`/jobs/${banner.jobId}`, { state: { returnScrollY: window.scrollY } })
  }
  return <section className="jobs-banner" aria-roledescription="carousel" aria-label="직무 찾기 안내" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}>
    <div className="jobs-banner-track" style={{ transform: `translateX(-${active * 100}%)` }}>
      {banners.map((banner, index) => <article
        key={banner.key}
        className={`jobs-banner-slide is-${banner.key} ${banner.kind === 'job' ? `is-layout-${index % 4 + 1}` : ''} ${banner.institution?.logoStyle === 'wide' ? 'has-wide-logo' : ''} ${banner.tone ? `is-tone-${banner.tone}` : ''} ${banner.kind === 'promo' ? 'is-service-promo' : ''}`}
        style={{ '--jobs-banner-image': `url(${banner.image})` }}
        role="link"
        tabIndex={active === index ? 0 : -1}
        aria-hidden={active !== index}
        onClick={() => openBanner(banner)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBanner(banner) } }}
      >
        {banner.kind === 'job'
          ? <div className="jobs-banner-copy"><div className="jobs-banner-company-inline"><InstitutionLogo institution={banner.institution} /><strong>{banner.institution.name}</strong></div><h2>{banner.title}</h2><p className="jobs-banner-meta">{banner.detail}</p></div>
          : <div className="jobs-banner-copy jobs-banner-service-copy"><strong>현장뛰자.</strong><h2>나에게 맞는 현장실습을 한눈에</h2><p>직무 탐색부터 지원 순서까지 한곳에서 준비하세요.</p></div>}
      </article>)}
    </div>
    <button type="button" className="jobs-banner-arrow is-prev" aria-label="이전 배너" onClick={() => move(-1)}>‹</button>
    <button type="button" className="jobs-banner-arrow is-next" aria-label="다음 배너" onClick={() => move(1)}>›</button>
    <div className="jobs-banner-pagination" aria-label="배너 선택">{banners.map((banner, index) => <button type="button" key={banner.key} className={active === index ? 'is-active' : ''} aria-label={`${index + 1}번째 배너`} aria-current={active === index ? 'true' : undefined} onClick={(event) => { event.stopPropagation(); setActive(index) }} />)}</div>
    <span className="jobs-banner-count"><b>{active + 1}</b> / {banners.length}</span>
  </section>
}

// 판정 미리보기 팝오버(확인 필요 이유 · 문서 검토) — 마우스를 올리면 판정 이유 줄을 보여 준다
function DecisionPreview({ type, reasons = [], count = 0, interactiveChild = false, children }) {
  const anchorRef = useRef(null)
  const popoverRef = useRef(null)
  const timerRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const matching = reasons.filter((reason) => type === 'document' ? reason.alertId != null : reason.result === 'CHECK')
  useLayoutEffect(() => {
    if (!preview?.anchor || !popoverRef.current) return
    const rect = preview.anchor
    const popover = popoverRef.current.getBoundingClientRect()
    const edge = 16
    const gap = 10
    const roomRight = window.innerWidth - rect.right - edge
    const roomLeft = rect.left - edge
    if (roomRight >= popover.width || roomLeft >= popover.width) {
      const placeRight = roomRight >= popover.width
      const left = placeRight ? rect.right + gap : rect.left - popover.width - gap
      const top = rect.top + popover.height <= window.innerHeight - edge ? Math.max(edge, rect.top) : Math.max(edge, rect.bottom - popover.height)
      setPreview({ left, top, placement: placeRight ? 'right' : 'left' })
      return
    }
    const above = window.innerHeight - rect.bottom - edge < popover.height
    const left = Math.max(edge, Math.min(rect.left, window.innerWidth - popover.width - edge))
    setPreview({ left, top: above ? rect.top - gap : rect.bottom + gap, placement: above ? 'above' : 'below' })
  }, [preview])
  const show = () => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (rect) setPreview({ left: rect.left, top: rect.bottom + 10, placement: 'measuring', anchor: rect })
    }, 200)
  }
  const hide = () => { window.clearTimeout(timerRef.current); setPreview(null) }
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  const title = type === 'document' ? '문서 검토 미리보기' : '확인 필요 이유'
  return <span ref={anchorRef} className="decision-preview-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex={interactiveChild ? undefined : 0}>
    {children}
    {preview && createPortal(<aside ref={popoverRef} className={`decision-preview-popover is-${preview.placement}`} style={{ left: preview.left, top: preview.top }} role="tooltip">
      <div className="decision-preview-heading"><b>{title}</b>{type === 'document' && <span>{count || matching.length}건</span>}</div>
      {matching.length
        ? <div className="decision-preview-list">{matching.slice(0, 3).map((reason, index) => <article key={`${reason.item}-${index}`}><strong>{reason.item}</strong><p><span>필요 조건</span>{reason.requirement}</p><p><span>내 조건</span>{reason.mine}</p>{reason.citation?.quote && <blockquote>“{reason.citation.quote}”</blockquote>}{reason.citation && <small>{[reason.citation.documentTitle, reason.citation.page && `${reason.citation.page}쪽`].filter(Boolean).join(' · ')}</small>}</article>)}</div>
        : <p className="decision-preview-empty">{type === 'document' ? '판정에는 들어가지 않는 문서 검토 알림이에요. 내용은 직무 상세에서 볼 수 있어요.' : '세부 내용은 직무 상세에서 확인할 수 있어요.'}</p>}
    </aside>, document.body)}
  </span>
}

// 추천 이유 시트 — 판정 배지·탐색 단계 배지를 누르면 열린다. 기본 스크롤바 대신 둥근 이동 막대 하나(휠·드래그)
function ReasonSheet({ item, row, codes, explore, close }) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeRef = useRef(close)
  const closeTimer = useRef(null)
  const panelRef = useRef(null)
  const contentRef = useRef(null)
  const trackRef = useRef(null)
  const barDrag = useRef(null)
  const sheetDrag = useRef({ active: false, startY: 0, offset: 0 })
  const [bar, setBar] = useState({ top: 0, height: 0, visible: false })
  useEffect(() => { closeRef.current = close }, [close])
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    closeTimer.current = window.setTimeout(() => closeRef.current(), 360)
  }, [])
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => { if (event.key === 'Escape') requestClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { window.clearTimeout(closeTimer.current); document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape) }
  }, [requestClose])
  const updateBar = useCallback(() => {
    const content = contentRef.current
    const track = trackRef.current
    if (!content || !track) return
    const visible = content.scrollHeight > content.clientHeight
    const height = visible ? Math.max(42, track.clientHeight * (content.clientHeight / content.scrollHeight)) : 0
    const travel = track.clientHeight - height
    const top = visible ? (content.scrollTop / (content.scrollHeight - content.clientHeight)) * travel : 0
    setBar({ top, height, visible })
  }, [])
  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(updateBar)
    const observer = new ResizeObserver(updateBar)
    if (contentRef.current) observer.observe(contentRef.current)
    return () => { window.cancelAnimationFrame(frame); observer.disconnect() }
  }, [updateBar])
  const startBarDrag = (event) => {
    const content = contentRef.current
    if (!content) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    barDrag.current = { startY: event.clientY, startScroll: content.scrollTop }
  }
  const moveBarDrag = (event) => {
    const content = contentRef.current
    const track = trackRef.current
    if (!content || !track || !barDrag.current) return
    event.stopPropagation()
    const travel = track.clientHeight - bar.height
    const scrollTravel = content.scrollHeight - content.clientHeight
    if (travel > 0) content.scrollTop = barDrag.current.startScroll + (event.clientY - barDrag.current.startY) * (scrollTravel / travel)
  }
  const stopBarDrag = (event) => { event.stopPropagation(); barDrag.current = null }
  const startSheetDrag = (event) => {
    if (closing || event.target.closest('button, a, .reason-sheet-scrollbar')) return
    sheetDrag.current = { active: true, startY: event.clientY, offset: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
    panelRef.current?.classList.add('is-dragging', 'has-dragged')
  }
  const moveSheetDrag = (event) => {
    if (!sheetDrag.current.active || !panelRef.current) return
    const offset = Math.max(-90, event.clientY - sheetDrag.current.startY)
    sheetDrag.current.offset = offset
    panelRef.current.style.transform = `translateY(${offset}px)`
  }
  const endSheetDrag = (event) => {
    if (!sheetDrag.current.active || !panelRef.current) return
    sheetDrag.current.active = false
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const panel = panelRef.current
    panel.classList.remove('is-dragging')
    if (sheetDrag.current.offset >= panel.getBoundingClientRect().height * 0.2) { requestClose(); return }
    panel.classList.add('is-settling')
    panel.style.transform = 'translateY(0)'
    window.setTimeout(() => panel.classList.remove('is-settling'), 300)
  }

  const reasons = row?.reasons ?? []
  const checks = reasons.filter((reason) => reason.result === 'CHECK')
  const verdictSummary = item.verdict === 'ELIGIBLE' ? '지금 저장한 프로필로 확인되는 지원 조건을 모두 맞췄어요.'
    : item.verdict === 'NEEDS_CHECK' ? '프로필만으로 정할 수 없는 조건(포트폴리오·문서끼리 엇갈린 항목)이 있어 원문이나 담당자 확인이 필요해요.'
    : '지금 프로필에서 맞추지 못한 조건이 있어요.'
  const ruleSource = explore?.source === 'RULE'
  const fitSummary = ruleSource ? `AI 대신 지원 조건과 적합도 점수로 고른 자리예요(${label(codes, 'exploreFallback', explore.fallbackReason)}).`
    : `내 글과 공고가 이어진 짝 ${item.links?.length ?? 0}개를 AI가 찾고, 두 구절이 원문에 그대로 있는지 서버가 확인했어요. 순서는 규칙(이어진 단계 → 선호 전공 → 짝 수)이 정해요.`
  const reasonText = item.why?.summary ?? item.evidence?.reason
  return createPortal(<div className={`reason-sheet-overlay ${closing ? 'is-closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
    <section ref={panelRef} className="reason-sheet" role="dialog" aria-modal="true" aria-labelledby="reason-sheet-title" onPointerDown={startSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={endSheetDrag} onPointerCancel={endSheetDrag}>
      <span className="reason-sheet-grip" aria-hidden="true" />
      <button type="button" className="reason-sheet-close" aria-label="닫기" onClick={requestClose}>×</button>
      <div className="reason-sheet-scroll-shell">
        <div ref={contentRef} className="reason-sheet-scroll-content" onScroll={updateBar}>
          <div className="reason-sheet-heading"><div><span>AI RECOMMENDATION · 추천 {item.rank}</span><h2 id="reason-sheet-title">이 직무를 추천하는 이유</h2></div><div className="reason-panel-badges"><VerdictBadge verdict={item.verdict} /><Badge>{label(codes, 'exploreFit', item.fit)}</Badge>{row?.alertCount > 0 && <Badge tone="orange">문서 검토 {row.alertCount}건</Badge>}</div></div>
          <div className="reason-sheet-job"><small>{item.institution.name} · {item.team}</small><h3>{item.title}</h3>{reasonText && <p>{reasonText}</p>}</div>
          <div className="reason-sheet-explanations">
            <section><span>지원 판정 · 규칙</span><h3>{label(codes, 'verdict', item.verdict)}인 이유</h3><p>{verdictSummary}</p></section>
            <section><span>직무 탐색 · {ruleSource ? '규칙' : 'AI'}</span><h3>{label(codes, 'exploreFit', item.fit)}</h3><p>{fitSummary}</p></section>
          </div>
          {item.links?.length > 0 && <div className="reason-sheet-citations">{item.links.map((link, index) => <article key={`${link.studentQuote}-${index}`}>
            <span>{label(codes, 'exploreFit', link.kind)} · {label(codes, 'exploreBasis', link.basis)}</span>
            <blockquote>“{link.studentQuote}”</blockquote>
            <p>{link.jobQuote ? <>→ 공고 “{link.jobQuote}”{link.documentTitle && ` · ${link.documentTitle}`}{link.page != null && ` ${link.page}쪽`}</> : '→ 공고 원문 칸에서 같은 글을 찾지 못했어요'}</p>
          </article>)}</div>}
          {ruleSource && item.evidence?.jobQuote && <div className="reason-sheet-citations"><article><span>공고 근거</span><blockquote>“{item.evidence.jobQuote}”</blockquote><p>{[item.evidence.documentTitle, item.evidence.page != null && `${item.evidence.page}쪽`].filter(Boolean).join(' · ')}</p></article></div>}
          {reasons.length > 0 && <div className="reason-sheet-criteria"><h3>조건별 판단 근거</h3>{reasons.map((reason, index) => <article key={`${reason.layer}-${reason.item}-${index}`}><div><b>{reason.item}</b><dl><div><dt>필요 조건</dt><dd>{reason.requirement}</dd></div><div><dt>내 조건</dt><dd>{reason.mine}</dd></div></dl></div><span className={`is-${reason.result.toLowerCase()}`}>{label(codes, 'reasonResult', reason.result)}</span></article>)}</div>}
          {(checks.length > 0 || row?.alertCount > 0) && <div className="reason-sheet-checks"><h3>확인 필요 · 문서 검토</h3>{checks.length > 0 && <p>확인 필요 조건 {checks.length}개는 프로필만으로 판정할 수 없어 원문 확인이 필요해요.</p>}{row?.alertCount > 0 && <p>공고 문서에서 서로 다르거나 더 확인할 내용 {row.alertCount}건을 찾았어요. 직무 상세의 공고 정보에서 두 원문을 볼 수 있어요.</p>}</div>}
          <div className="reason-sheet-scroll-end" aria-hidden="true" />
        </div>
        <div ref={trackRef} className={`reason-sheet-scrollbar ${bar.visible ? 'is-visible' : ''}`} aria-hidden="true"><span style={{ height: bar.height, transform: `translateY(${bar.top}px)` }} onPointerDown={startBarDrag} onPointerMove={moveBarDrag} onPointerUp={stopBarDrag} onPointerCancel={stopBarDrag} /></div>
      </div>
      <div className="reason-sheet-footer"><Link className="reason-sheet-detail" to={`/jobs/${item.jobId}`} state={{ returnScrollY: window.scrollY }}>직무 상세에서 '왜 나에게 맞나요' 보기 <span>→</span></Link></div>
    </section>
  </div>, document.body)
}

function SaveLabel({ busy, saved, rank }) {
  if (busy) return <i className="save-button-spinner" aria-label="처리 중" />
  if (!saved) return '담기'
  return rank ? `${rank}지망` : '담았어요'
}

// 추천 카드 하나 — 탐색 결과(#30) 한 곳 + 같은 직무의 판정 행(#14: NCS·조회수·담기)
function RecommendationCard({ item, row, codes, saved, rank, busy, disabled, onSave, onReason, keepOpen }) {
  const navigate = useNavigate()
  const openDetail = () => navigate(`/jobs/${item.jobId}`, { state: { returnScrollY: window.scrollY } })
  const showReason = (event) => { event.stopPropagation(); onReason(item) }
  const reason = item.why?.summary ?? item.evidence?.reason
  const quote = item.evidence?.studentQuote
  const after = quote ? `${shorten(quote, 16)} → ${shorten(item.evidence?.jobQuote, 18) || '공고'}` : item.evidence?.jobQuote ? `공고 “${shorten(item.evidence.jobQuote, 26)}”` : ''
  const meta = [item.team, row?.majorMatch && (MAJOR_LABEL[row.majorMatch] ?? label(codes, 'majorMatch', row.majorMatch))].filter(Boolean).join(' · ')
  const verdictBadge = <button type="button" className="recommend-insight-button" onClick={showReason}><VerdictBadge verdict={item.verdict} /></button>
  return <article className={`recommend-card ${keepOpen ? 'actions-open' : ''}`} role="link" tabIndex="0" onClick={openDetail} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openDetail() } }}>
    <div className="recommend-card-top"><span className="recommend-rank">추천 {item.rank}</span><div>
      {item.verdict === 'NEEDS_CHECK' ? <DecisionPreview type="check" reasons={row?.reasons} interactiveChild>{verdictBadge}</DecisionPreview> : verdictBadge}
      <button type="button" className="recommend-insight-button" onClick={showReason}><Badge>{label(codes, 'exploreFit', item.fit)}</Badge></button>
    </div></div>
    <div className="recommend-company-block"><InstitutionLogo institution={item.institution} /><small className="recommend-company">{item.institution.name}</small></div>
    <h3 title={item.title}>{item.title}</h3>
    {meta && <p className="recommend-meta">{meta}</p>}
    {reason && <p className="recommend-reason"><span className="recommend-ai-label">AI</span>{reason}</p>}
    {after && <p className="jb-after" title={quote ? `${quote} → ${item.evidence?.jobQuote ?? ''}` : item.evidence?.jobQuote}><b>탐색</b><span>{after}</span></p>}
    {row && <p className="recommend-views">조회 {row.views.toLocaleString('ko-KR')}</p>}
    <div className="recommend-card-bottom">
      <button type="button" onClick={(event) => { event.stopPropagation(); openDetail() }}>추천 이유 보기</button>
      <button type="button" className={`recommend-save-button ${saved ? 'saved' : ''}`} disabled={disabled} title={saved ? '다시 누르면 담기를 취소해요' : undefined} onClick={(event) => { event.stopPropagation(); onSave(item.jobId) }}><SaveLabel busy={busy} saved={saved} rank={rank} /></button>
    </div>
  </article>
}

// 위쪽 추천 영역 — 탐색 결과가 있으면 진단 띠 + 카드, 없으면 탐색 안내 상자
function ExploreArea({ explore, codes, rowsById, savedOf, rankOf, busyId, onSave, onReason, toastJobId }) {
  if (explore.loading) return <div className="v2-diag-bar jb-loading" role="status"><span className="v2-spinner" aria-hidden="true" /><p>저장한 직무 탐색 결과를 불러오는 중이에요…</p></div>
  if (explore.error?.code === 'EXPLORE_NOT_FOUND') return <section className="jb-cta"><div><span className="v2-ai">AI</span><h3>직무 탐색을 하면 여기에 추천이 떠요</h3><p>해 본 일 · 하고 싶은 일을 적으면, 지원 조건을 맞춘 자리만 놓고 AI가 공고와 함께 읽어 맞는 곳과 이유를 골라 드려요. 탐색 전에는 아래 전체 목록에서 판정만 볼 수 있어요.</p></div><Link className="v2-btn" to="/explore">직무 탐색 하러 가기 →</Link></section>
  if (explore.error) return <div className="v2-diag-bar is-error" role="alert"><span className="v2-ai">AI</span><p>탐색 결과를 불러오지 못했어요. 아래 전체 목록은 그대로 볼 수 있어요.</p><button type="button" className="v2-btn sm gray" onClick={explore.reload}>다시 불러오기</button></div>
  const data = explore.data
  if (!data) return null
  const items = data.items.slice(0, 5)
  const input = data.input ?? {}
  const chips = [
    input.experiences?.length > 0 && ['v2-src exp', `경험 ${input.experiences.length}개`],
    input.cards?.length > 0 && ['v2-src want', `하고 싶은 일 ${input.cards.length}개`],
    input.interestText && ['v2-src interest', '관심 분야'],
  ].filter(Boolean)
  const notes = [
    data.source === 'RULE' && `AI 대신 규칙 추천이에요(${label(codes, 'exploreFallback', data.fallbackReason)})`,
    data.hiddenCount > 0 && `지금 프로필로 다시 판정해 ${data.hiddenCount}곳을 뺐어요`,
  ].filter(Boolean)
  return <>
    <div className="v2-diag-bar"><span className="v2-ai">AI</span><p><b>{fmtDate(data.createdAt)} 직무 탐색</b>을 반영한 순서예요 · 지원 조건(학년 · 학점 · 자격증)을 맞춘 {data.candidates?.total ?? 0}개 안에서 골라요{notes.length > 0 && <small className="jb-diag-note"> · {notes.join(' · ')}</small>}</p><div className="v2-chips">{chips.map(([cls, text]) => <span key={text} className={cls}>{text}</span>)}</div><Link className="v2-link" to="/explore/result">탐색 결과 보기 →</Link></div>
    {items.length === 0
      ? <section className="jb-cta is-empty"><div><span className="v2-ai">AI</span><h3>탐색한 글과 이어지는 자리를 찾지 못했어요</h3><p>{data.blockedBy?.length > 0 ? `빠진 까닭: ${data.blockedBy.map((block) => `${block.item} ${block.count}곳`).join(' · ')}. ` : ''}경험을 조금 더 자세히 적거나 '하고 싶은 일' 카드를 골라 다시 탐색해 보세요. 아래 전체 목록에서 판정은 그대로 볼 수 있어요.</p></div><Link className="v2-btn line" to="/explore">다시 탐색하기 →</Link></section>
      : <div id="recommendations" className="jobs-scroll-anchor"><section className="recommendations">{items.map((item) => <RecommendationCard key={item.jobId} item={item} row={rowsById[item.jobId]} codes={codes} saved={savedOf(item.jobId)} rank={rankOf(item.jobId)} busy={busyId === item.jobId} disabled={busyId !== null} onSave={onSave} onReason={onReason} keepOpen={toastJobId === item.jobId} />)}</section></div>}
  </>
}

function Blocked({ children }) {
  return <main className="content wide jobs-page"><div className="jobs-page-inner"><PageTitle title="지원할 수 있는 현장실습을 찾아보세요" /><div className="card form-card jobs-blocked-card jb-blocked">{children}</div></div></main>
}

function JobsLoading({ message, detail }) {
  return <main className="jobs-loading-page"><div className="jobs-loading-content" role="status"><i className="jobs-loading-spinner" aria-hidden="true" /><strong>LOADING</strong><span>{message}</span><small>{detail}</small></div></main>
}

function LoginRequired() {
  const { start, loadingRole, error } = useGuestStart()
  return <main className="jobs-login-page"><section className="jobs-login-content"><div className="jobs-login-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 10V8a5 5 0 0 1 10 0v2" /><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M12 14v3" /></svg></div><span className="jobs-login-kicker">로그인하고</span><h1>나에게 맞는 직무를 찾아보세요</h1><div className="jobs-login-actions"><Link className="jobs-login-button" to="/login">로그인하러 가기</Link><button type="button" className="jobs-example-button" disabled={loadingRole !== null} onClick={() => start('STUDENT')}>{loadingRole === 'STUDENT' ? '예시 프로필 준비 중…' : '예시 프로필로 시작하기'}</button></div>{error && <p className="jobs-login-error" role="alert">{error}</p>}</section></main>
}

function useRotatingTitle() {
  const [index, setIndex] = useState(0)
  const [motion, setMotion] = useState('')
  useEffect(() => {
    let changeTimer
    let enterTimer
    const interval = window.setInterval(() => {
      setMotion('is-leaving')
      changeTimer = window.setTimeout(() => {
        setIndex((current) => (current + 1) % TITLE_PREFIXES.length)
        setMotion('is-entering')
        enterTimer = window.setTimeout(() => setMotion(''), 60)
      }, 760)
    }, 6000)
    return () => { window.clearInterval(interval); window.clearTimeout(changeTimer); window.clearTimeout(enterTimer) }
  }, [])
  return <span className="jobs-title-composed"><span className={`jobs-title-message ${motion}`}>{TITLE_PREFIXES[index]}</span><span className="jobs-title-fixed">찾아보세요</span></span>
}

export function JobsPage() {
  const navigate = useNavigate()
  const title = useRotatingTitle()
  const loggedIn = Boolean(getToken())
  const codes = useCodes()
  const eligibility = useRequest(loadEligibility, loggedIn)
  const explore = useRequest(loadExplore, loggedIn)
  const round = useRequest(loadRound)

  const [filter, setFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [reasonItem, setReasonItem] = useState(null)
  const [listMotion, setListMotion] = useState('')
  const [controlsLeaving, setControlsLeaving] = useState(false)
  const filterTimer = useRef(null)
  const enterTimer = useRef(null)
  useEffect(() => () => { window.clearTimeout(filterTimer.current); window.clearTimeout(enterTimer.current) }, [])
  const transitionResults = (update, swapControls = false) => {
    if (listMotion === 'is-leaving') return
    window.clearTimeout(filterTimer.current); window.clearTimeout(enterTimer.current)
    setListMotion('is-leaving'); if (swapControls) setControlsLeaving(true)
    filterTimer.current = window.setTimeout(() => {
      update(); setShowAll(false); setListMotion('is-entering'); setControlsLeaving(false)
      enterTimer.current = window.setTimeout(() => setListMotion(''), 50)
    }, 260)
  }
  const changeFilter = (next) => { if (next !== filter) transitionResults(() => setFilter(next)) }
  const submitSearch = (event) => {
    event.preventDefault()
    const next = searchQuery.trim()
    if (!next || next === appliedSearch) return
    transitionResults(() => { setAppliedSearch(next); setFilter('ALL') }, !appliedSearch)
  }
  const showAllJobs = () => transitionResults(() => { setAppliedSearch(''); setSearchQuery(''); setFilter('ALL') }, true)

  // 담기: 처음 값은 판정 행의 planned·planRank, 누를 때마다 담기(#20)·빼기(#21)를 오간다
  const [overrides, setOverrides] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [toast, setToast] = useState(null)
  const toastId = useRef(0)
  const rowsById = useMemo(() => Object.fromEntries((eligibility.data?.jobs ?? []).map((job) => [job.jobId, job])), [eligibility.data])
  const savedOf = (jobId) => overrides[jobId] ?? Boolean(rowsById[jobId]?.planned)
  const rankOf = (jobId) => (overrides[jobId] === undefined ? rowsById[jobId]?.planRank ?? null : null)
  const save = async (jobId) => {
    if (busyId !== null) return
    const wasSaved = savedOf(jobId)
    setBusyId(jobId)
    try {
      if (wasSaved) await removePlanItem(jobId)
      else await addPlanItem(jobId)
      setOverrides((current) => ({ ...current, [jobId]: !wasSaved }))
      setToast({ id: ++toastId.current, jobId, type: wasSaved ? 'removed' : 'added', message: wasSaved ? '담기를 취소했어요' : '직무를 담았어요' })
    } catch (caught) {
      setToast({ id: ++toastId.current, jobId, type: 'error', message: planErrorMessage(caught, wasSaved ? '빼기' : '담기') })
    } finally {
      setBusyId(null)
    }
  }


  if (!loggedIn) return <><InteractiveCareerBook loggedIn={false} /><LoginRequired /></>
  if (eligibility.loading && !eligibility.data) return <JobsLoading message="내 조건에 맞는 직무를 찾고 있어요" detail="저장한 프로필로 공고의 지원 조건을 하나씩 비교하고 있어요. 서버가 잠들어 있으면 1분 가까이 걸려요." />
  const error = eligibility.error
  if (error?.code === 'PROFILE_NOT_FOUND') return <Blocked><h3>저장한 프로필이 없어요</h3><p>학과·학년·이수 학기·평점을 저장하면 회차 직무 40개의 지원 판정을 바로 보여 드려요. 저장은 동의할 때만 해요.</p><Link className="v2-btn" to="/me" state={{ editProfile: true }}>내 정보에서 프로필 저장하기 →</Link></Blocked>
  if (error?.code === 'FORBIDDEN_ROLE') return <Blocked><h3>학생 계정에서 볼 수 있어요</h3><p>직무 판정은 학생 계정 화면이에요. 센터 담당자는 현황판에서 직무별 현황을 볼 수 있어요.</p><Link className="v2-btn line" to="/center">현황판으로 →</Link></Blocked>
  if (error?.status === 401) return <Blocked><h3>로그인 정보가 없거나 만료됐어요</h3><p>체험 계정은 24시간 뒤 지워져요. 다시 로그인하거나 예시 프로필로 시작해 주세요.</p><Link className="v2-btn" to="/login">다시 로그인하기 →</Link></Blocked>
  if (error) return <Blocked><h3>판정 결과를 불러오지 못했어요</h3><p>{error.code === 'INVALID_INPUT' ? `프로필 값을 확인해 주세요. ${error.fields.map((field) => field.reason).join(' · ')}` : error.code === 'NETWORK' ? '서버에 연결하지 못했어요. 서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요.' : '잠시 뒤 다시 시도해 주세요.'}</p><button type="button" className="v2-btn line" onClick={eligibility.reload}>다시 불러오기</button></Blocked>
  if (!eligibility.data) return null

  const { summary, jobs } = eligibility.data
  const counts = { ALL: summary.total, ELIGIBLE: summary.eligible, NEEDS_CHECK: summary.needsCheck, INELIGIBLE: summary.ineligible }
  const query = appliedSearch.toLowerCase()
  const shown = jobs.filter((job) => (filter === 'ALL' || job.verdict === filter) && (!query || job.title.toLowerCase().includes(query)))
  const visible = showAll ? shown : shown.slice(0, SHOW)
  const recCount = explore.data ? Math.min(explore.data.items.length, 5) : '–'
  const openRow = (jobId) => navigate(`/jobs/${jobId}`, { state: { returnScrollY: window.scrollY } })

  return <main className="content wide jobs-page jobs-page-ready">
    <InteractiveCareerBook loggedIn />
    <div className="jobs-page-inner">
      <JobsBanner />
      <div className="jobs-heading"><PageTitle title={title} /><div className="result-summary"><div><small>추천</small><b>{recCount}</b></div><div><small>지원 가능</small><b>{summary.eligible}</b></div><div><small>확인 필요</small><b>{summary.needsCheck}</b></div><div><small>전체</small><b>{summary.total}</b></div></div></div>

      <ExploreArea explore={explore} codes={codes} rowsById={rowsById} savedOf={savedOf} rankOf={rankOf} busyId={busyId} onSave={save} onReason={setReasonItem} toastJobId={toast?.jobId} />

      <section id="all-jobs" className="card jobs-list">
        <div className="list-header">
          <div className="job-list-title"><span>ALL POSITIONS</span><b>전체 직무</b><form className="job-search" onSubmit={submitSearch}><span aria-hidden="true">⌕</span><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="직무명 검색" aria-label="직무명 검색" /><button type="submit">검색</button></form></div>
          <div className={`job-list-control ${controlsLeaving ? 'is-leaving' : 'is-entering'}`}>{appliedSearch
            ? <button type="button" className="show-all-jobs" onClick={showAllJobs}>전체 직무 보기</button>
            : <div className="filter">{FILTERS.map(([key, name]) => <button type="button" key={key} className={filter === key ? 'selected' : ''} onClick={() => changeFilter(key)}>{name} <b>{counts[key]}</b></button>)}</div>}</div>
        </div>
        <div className="job-list-columns"><span>직무·기관</span><span>선호 전공(참고)</span><span>판정</span><span>모집 상태</span><span>관리</span></div>
        <div className={`job-list-results ${listMotion}`}>
          {shown.length === 0 && <p className="jb-list-empty">{appliedSearch ? `‘${appliedSearch}’가 직무명에 들어간 직무가 없어요.` : '이 판정에 해당하는 직무가 없어요.'}</p>}
          {visible.map((job) => {
            const saved = savedOf(job.jobId)
            const closed = isClosed(job.closing, round.data)
            return <div className={`job-row ${job.verdict === 'INELIGIBLE' ? 'is-ineligible' : ''}`} role="link" tabIndex="0" key={job.jobId} onClick={() => openRow(job.jobId)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openRow(job.jobId) } }}>
              <div className="job-main"><InstitutionLogo institution={job.institution} compact /><div><b>{job.title}</b><small>{job.institution.name} · {job.team} · 조회 {job.views.toLocaleString('ko-KR')}</small></div></div>
              <div className="job-major"><Badge>{MAJOR_LABEL[job.majorMatch] ?? label(codes, 'majorMatch', job.majorMatch)}</Badge>{job.alertCount > 0 && <DecisionPreview type="document" reasons={job.reasons} count={job.alertCount}><Badge tone="orange">문서 검토</Badge></DecisionPreview>}</div>
              <div>{job.verdict === 'NEEDS_CHECK' ? <DecisionPreview type="check" reasons={job.reasons}><VerdictBadge verdict={job.verdict} /></DecisionPreview> : <VerdictBadge verdict={job.verdict} />}</div>
              <span className={`job-closing ${closed ? 'is-closed' : 'is-open'}`}>{closingText(job.closing, round.data)}</span>
              <div className="job-actions"><button type="button" className={`save-button ${saved ? 'saved' : ''}`} disabled={busyId !== null} title={saved ? '다시 누르면 담기를 취소해요(지망 순위도 지워져요)' : undefined} onClick={(event) => { event.stopPropagation(); save(job.jobId) }}><SaveLabel busy={busyId === job.jobId} saved={saved} rank={rankOf(job.jobId)} /></button></div>
            </div>
          })}
          {shown.length > SHOW && <button type="button" className="v2-more-row" onClick={() => setShowAll((value) => !value)}>{showAll ? '접기 ↑' : `나머지 ${shown.length - SHOW}개 더 보기 ↓`}</button>}
        </div>
      </section>
      <p className="jb-foot">판정은 저장한 프로필로 본 규칙 판정이에요 · 모집 상태는 {round.data ? `${fmtDate(judgeDate(round.data))} 기준` : '모집 판정 기준일 기준'} · 담기는 지원이 아니고, 담은 직무와 1~3지망은 내 현장실습에서 정해요</p>
    </div>
    {reasonItem && <ReasonSheet item={reasonItem} row={rowsById[reasonItem.jobId]} codes={codes} explore={explore.data} close={() => setReasonItem(null)} />}
    {toast && <Toast key={toast.id} className="first-save-toast" onAnimationEnd={() => setToast((current) => current?.id === toast.id ? null : current)}><span className={`first-save-toast-icon ${toast.type}`} aria-hidden="true">{toast.type === 'removed' ? '−' : toast.type === 'error' ? '!' : '✓'}</span><div><b>{toast.message}</b><small>{toast.type === 'error' ? '잠시 뒤 다시 눌러 주세요.' : '담은 직무와 지망 순위는 내 현장실습에서 볼 수 있어요.'}</small></div><Link to="/internship">내 현장실습 보기</Link></Toast>}
  </main>
}
