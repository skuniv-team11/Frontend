import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import jobAnimation from '../../assets/images/job-animation.mp4'
import processMascot from '../../assets/images/process-mascot.png'
import jobAnimationFrame from './job-animation-frame.webp'
import { getMyExplore } from '../../api/explore'
import { getMyInternship } from '../../api/internship'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { label } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { ErrorBox, InstitutionLogo, Loading, VirtualTag } from '../../components/v2'
import { useGuestStart } from '../../hooks/useGuestStart'
import { useRequest } from '../../hooks/useRequest'
import { useCodes, useSession } from '../../hooks/useSession'
import { fmtDate, studentAppStatus, VERDICT_LABEL } from '../../lib/format'
import { STAGES, stageTitle } from '../../lib/stages'
import './StartPage.css'
import './StartPageProcess.css'
import './HomePage.css'
import story1 from '../../assets/images/story/story-1.jpg'
import story2 from '../../assets/images/story/story-2.jpg'
import story3 from '../../assets/images/story/story-3.jpg'
import story4 from '../../assets/images/story/story-4.jpg'
import story5 from '../../assets/images/story/story-5.jpg'
import story6 from '../../assets/images/story/story-6.jpg'
import story7 from '../../assets/images/story/story-7.jpg'
import story8 from '../../assets/images/story/story-8.jpg'

const loadExplore = (signal) => getMyExplore(signal)
const loadInternship = (signal) => getMyInternship(signal)
const loadPlan = (signal) => getMyPlan(signal)

const heroMessages = [
  <>내가 갈 수 있는 현장실습,<br /><em>한눈에 찾다.</em></>,
  <>해 본 일로 찾는<br /><em>나에게 맞는 현장실습.</em></>,
  <>지원서부터 학점 인정까지,<br /><em>한곳에서 이어서.</em></>,
]

// 선배 이야기 — 옛 랜딩의 고정 콘텐츠(우수 참여수기에서 옮김, 이름·학과 없음)
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
// 선배 이야기 띠 사진(Unsplash 라이선스, 저장소에 둔다 — 외부 사이트를 직접 부르지 않게)
const storyFilm = [[story1, story2, story3, story4], [story5, story6, story7, story8]]

// 여정 4단계 ↔ #44 일정 단계(phase)
const JOURNEY = [
  { n: 1, title: '직무 탐색' },
  { n: 2, title: '지원하기', phases: ['APPLY'], to: '/internship', desc: '1~3지망 · 지원서 · 학과장 승인 → 마감 뒤 매칭 · 면접' },
  { n: 3, title: '실습하기', phases: ['PREPARE', 'PRACTICE'], to: '/internship' },
  { n: 4, title: '커리어 잇기', phases: ['CLOSE'], to: '/career', desc: '실습으로 채운 역량과 펼쳐 갈 직무' },
]
const CIRCLED = ['①', '②', '③', '④']
const groupState = (stages, phases) => {
  const list = stages.filter((stage) => phases.includes(stage.phase))
  if (list.some((stage) => stage.state === 'NOW')) return 'NOW'
  if (list.length && list.every((stage) => stage.state === 'DONE')) return 'DONE'
  return 'NEXT'
}
// 탐색은 선택이다. 지원하기 단계가 지났거나 매칭된 자리가 있으면, 탐색을 안 했어도 '아직 안 했어요'가 아니라 건너뛴 것으로 본다
const exploreSkipped = (data) => Boolean(data?.placement) || groupState(data?.stages ?? [], ['APPLY']) === 'DONE'
const ddayText = (days) => (days === 0 ? 'D-day' : days > 0 ? `D-${days}` : `D+${-days}`)
const weeksBetween = (start, end) => {
  if (!start || !end) return null
  const days = (new Date(`${end}T00:00:00+09:00`) - new Date(`${start}T00:00:00+09:00`)) / 86400000 + 1
  return Math.ceil(days / 7)
}

export function HomePage() {
  useLocation() // 체험 계정을 만든 뒤 같은 '/'로 돌아와도 다시 그린다
  const navigate = useNavigate()
  const session = useSession()
  const [choosing, setChoosing] = useState(false)
  const guest = useGuestStart((destination) => { setChoosing(false); navigate(destination) })
  const nextRef = useRef(null)

  const loggedIn = session.loggedIn
  const mode = !loggedIn ? 'guest' : session.isCenter ? 'center' : session.isStudent ? 'student' : 'loading'

  return <main className="landing home-landing">
    <Hero mode={mode} guest={guest} openStages={() => setChoosing(true)} onScroll={() => nextRef.current?.scrollIntoView({ behavior: 'smooth' })} />
    <div ref={nextRef} />
    {mode === 'guest' && <><GuestProcess /><GuestExplore openStages={() => setChoosing(true)} /><Stories /><GuestCta openStages={() => setChoosing(true)} /></>}
    {mode === 'loading' && <section className="home-process is-visible"><div className="process-layout home-single">{session.error ? <ErrorBox error={session.error} retry={session.reload} /> : <Loading text="내 정보를 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." />}</div></section>}
    {mode === 'student' && <StudentHome />}
    {choosing && <StageChooser guest={guest} close={() => setChoosing(false)} />}
  </main>
}

function Hero({ mode, guest, openStages, onScroll }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [fading, setFading] = useState(false)
  useEffect(() => {
    let swap
    const timer = window.setInterval(() => {
      setFading(true)
      swap = window.setTimeout(() => { setMessageIndex((current) => (current + 1) % heroMessages.length); setFading(false) }, 850)
    }, 7000)
    return () => { window.clearInterval(timer); window.clearTimeout(swap) }
  }, [])
  const { start, loadingRole, error } = guest

  return <section className="home-hero"><div className="home-hero-content"><div className="hero">
    <span className="eyebrow">학교 밖에서, 내 일을 먼저 만나보세요</span>
    <h1 key={messageIndex} className={`hero-message ${fading ? 'is-fading' : ''}`}>{heroMessages[messageIndex]}</h1>
    {mode === 'guest' && <>
      <div className="button-row">
        <Link className="button primary" to="/login">로그인 · 가입</Link>
        <button type="button" className="button glass-button" disabled={loadingRole !== null} onClick={openStages}>{loadingRole === 'STUDENT' ? '체험 계정 만드는 중…' : '체험 학생으로 시작'}</button>
      </div>
      <p className="home-hero-note">체험 계정은 가입 없이 예시 프로필(메이크업디자인학과 3학년)로 시작해요. 24시간 뒤 지워져요.</p>
      {error && <p className="guest-error" role="alert">{error}</p>}
      {loadingRole && <p className="guest-wait">서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>}
    </>}
    {mode === 'student' && <div className="button-row"><Link className="button hero-jobs-button" to="/jobs">직무 찾아보기</Link><Link className="button glass-button hero-explore-button" to="/explore">직무 탐색하기</Link></div>}
    {mode === 'center' && <>
      <div className="button-row"><Link className="button hero-jobs-button" to="/center">현황판으로 가기</Link></div>
      <p className="home-hero-note">현장실습지원센터 담당자 계정이에요. 접수 · 매칭 · 마무리는 센터 화면에서 봐요.</p>
    </>}
  </div></div>
    {mode === 'guest' && <button type="button" className="center-link" disabled={loadingRole !== null} onClick={() => start('CENTER')}>{loadingRole === 'CENTER' ? '센터 체험 계정 만드는 중…' : '센터 화면 →'}</button>}
    {mode === 'student' && <Link className="center-link" to="/center">센터 화면 →</Link>}
    {mode !== 'center' && <button type="button" className="scroll-cue" onClick={onScroll}><span>아래로 살펴보기</span><b>↓</b></button>}
  </section>
}

// 체험 학생 시점 고르기 — 날짜는 codes.guestStage
function StageChooser({ guest, close }) {
  const { start, loadingRole, error } = guest
  const codes = useCodes()
  const [picked, setPicked] = useState(null)
  return <Modal close={close} className="home-stage-modal">{(dismiss) => <>
    <h2>체험할 시점을 골라 주세요</h2>
    <p>예시 프로필(메이크업디자인학과 3학년)로 체험 계정을 만들어요. 가입은 필요 없고 24시간 뒤 지워져요. 실습 중 · 마친 뒤는 지난 기록(가상)을 갖고 시작해요.</p>
    <div className="home-stage-list">{STAGES.map(([stage, title, sub]) => <button key={stage} type="button" disabled={loadingRole !== null} onClick={() => { setPicked(stage); start('STUDENT', stage) }}>
      <b>{loadingRole === 'STUDENT' && picked === stage ? '체험 계정 만드는 중…' : stageTitle(codes, stage, title)}</b><small>{sub}</small><i aria-hidden="true">→</i>
    </button>)}</div>
    {loadingRole && <p className="home-stage-wait">서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>}
    {error && <p className="danger" role="alert">{error}</p>}
    <button type="button" className="fx-btn ghost" onClick={dismiss} disabled={loadingRole !== null}>닫기</button>
  </>}</Modal>
}

function GuestProcess() {
  return <section className="home-process is-visible"><div className="process-layout">
    <div className="process-copy">
      <div className="process-intro">
        <p className="process-kicker">현장실습을 시작하는 가장 가까운 곳</p>
        <p>현장뛰자는 전공과 학년을 바탕으로 지원할 수 있는 현장실습을 찾고, 공고 원문 근거를 확인하며, 관심 있는 직무를 1~3지망으로 정리할 수 있도록 돕는 서비스입니다. 복잡하게 흩어진 현장실습 준비를 한곳에서 더 분명하게 시작해 보세요.</p>
      </div>
      <div className="process-guide">
        <div className="process-heading"><h3>네 단계를 한곳에서 이어서 챙겨요</h3></div>
        <div className="steps home-process-steps">
          {[['01', '직무 탐색', '해 본 일 · 하고 싶은 일로 맞는 현장실습 찾기'], ['02', '지원하기', '1~3지망 · 지원서 · 학과장 승인 → 마감 뒤 매칭 · 면접'], ['03', '실습하기', '이번 주 할 일과 중간점검'], ['04', '커리어 잇기', '실습으로 채운 역량과 펼쳐 갈 직무']].map(([n, title, desc]) =>
            <div key={n} className="process-step"><b>{n}</b><h4>{title}</h4><p>{desc}</p></div>)}
        </div>
      </div>
    </div>
    <div className="process-image"><img src={processMascot} alt="책상 앞에서 현장실습을 준비하는 마스코트" /></div>
  </div></section>
}

function MascotVideo() {
  const ref = useRef(null)
  const timer = useRef(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const play = () => {
    const video = ref.current
    if (!video) return
    window.clearTimeout(timer.current)
    video.currentTime = 0
    void video.play().catch(() => {})
  }
  return <div className="job-animation-slot" onClick={play} role="button" tabIndex={0} aria-label="클릭하면 마스코트가 인사해요" onKeyDown={(event) => { if (event.key === 'Enter') play() }}>
    <video ref={ref} muted playsInline autoPlay preload="auto" poster={jobAnimationFrame} aria-hidden="true" onEnded={() => { timer.current = window.setTimeout(play, 20000) }}><source src={jobAnimation} type="video/mp4" /></video>
  </div>
}

function GuestExplore({ openStages }) {
  return <section className="home-jobs is-visible is-settled"><div className="home-jobs-layout">
    <MascotVideo />
    <div className="home-jobs-content">
      <div className="home-section-heading"><h2 className="job-title-message">해 본 일로 나에게 맞는<br />현장실습을 찾아요</h2></div>
      <div className="home-how">
        {[['지원 조건 확인', '학년 · 이수 학기 · 평점 · 자격증을 못 맞춘 자리와 마감된 자리는 처음부터 빼요', '규칙', 'rule'],
          ['내 글과 업무의 짝 찾기', '해 본 일 · 고른 하고 싶은 일을 운영계획서의 하는 일과 맞춰 봐요', 'AI', 'ai'],
          ['근거 확인 · 순서', '인용 구절이 내 글과 공고 원문에 그대로 있는지 확인하고, 순서는 규칙이 정해요', '코드 · 규칙', 'rule'],
          ['실습 뒤 길', '맞는 자리마다 NCS 능력단위와 넓혀 갈 직무 · 일자리를 보여 줘요', 'NCS', 'rule']].map(([title, desc, who, cls], i) =>
          <article key={title}><span className={`fx-who ${cls}`}>{who}</span><b>{i + 1}. {title}</b><p>{desc}</p></article>)}
      </div>
      <div className="home-how-foot"><button type="button" className="v2-btn" onClick={openStages}>체험 학생으로 해 보기</button><span>학과 · 학년 · 평점은 AI에 보내지 않아요</span></div>
    </div>
  </div></section>
}

function Stories() {
  const [selected, setSelected] = useState(null)
  const listRef = useRef(null)
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false })
  const barDrag = useRef(null)
  const direction = useRef(1)
  const [bar, setBar] = useState({ width: 0, left: 0 })
  const updateBar = () => {
    const list = listRef.current
    if (!list) return
    const trackWidth = list.clientWidth * 0.6
    const width = Math.max(42, trackWidth * list.clientWidth / list.scrollWidth * 0.7)
    const max = list.scrollWidth - list.clientWidth
    setBar({ width, left: max > 0 ? (trackWidth - width) * list.scrollLeft / max : 0 })
  }
  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const observer = new ResizeObserver(updateBar)
    observer.observe(list)
    updateBar()
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (selected || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let frame, previous, remainder = 0
    const tick = (time) => {
      const list = listRef.current
      if (list && previous !== undefined && !drag.current.active && !barDrag.current) {
        const max = list.scrollWidth - list.clientWidth
        remainder += Math.min(time - previous, 32) * 0.04
        const distance = Math.floor(remainder)
        remainder -= distance
        const next = list.scrollLeft + direction.current * distance
        if (next >= max) direction.current = -1
        if (next <= 0) direction.current = 1
        list.scrollLeft = Math.max(0, Math.min(max, next))
      }
      previous = time
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [selected])
  const down = (event) => { drag.current = { active: true, startX: event.clientX, startLeft: listRef.current?.scrollLeft ?? 0, moved: false } }
  const move = (event) => {
    if (!drag.current.active || !listRef.current) return
    const dx = event.clientX - drag.current.startX
    if (Math.abs(dx) > 5) drag.current.moved = true
    listRef.current.scrollLeft = drag.current.startLeft - dx
  }
  const up = () => { drag.current.active = false }
  const open = (story) => { if (drag.current.moved) { drag.current.moved = false; return } setSelected(story) }
  return <section className="home-stories is-visible">
    <div className="story-film" aria-hidden="true">{storyFilm.map((row, r) => <div key={r} className={`story-film-row ${r === 0 ? 'story-film-row-top' : 'story-film-row-bottom'}`}><div className="story-film-track">{[...row, ...row, ...row, ...row].map((src, i) => <img key={i} src={src} alt="" />)}</div></div>)}</div>
    <div className="home-stories-inner">
      <div className="home-section-heading story-heading"><div><h2>현장실습은 어떤 하루일까요?</h2><p className="story-subtitle">먼저 다녀온 선배들의 이야기를 들어보세요</p></div><span>우수 참여수기(학교가 고른 수기) 기준이에요. 기관을 평가하는 자료가 아니에요.</span></div>
      <div className="story-carousel"><div ref={listRef} className="story-list" onScroll={updateBar} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>
        {seniorStories.map((story) => <article key={story.key} className="story-card" role="button" tabIndex={0} onClick={() => open(story)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(story) } }}>
          <span>{story.category}</span><h3>{story.title}</h3>
          <ul className="story-card-preview">{story.activities.slice(0, 2).map((activity) => <li key={activity}>{activity}</li>)}</ul>
          <p className="story-card-meta">{story.meta}</p>
        </article>)}
      </div><div className="story-scrollbar" aria-hidden="true"><span style={{ width: bar.width, transform: `translateX(${bar.left}px)` }} onPointerDown={(event) => { barDrag.current = { x: event.clientX, left: listRef.current.scrollLeft }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={(event) => { if (!barDrag.current) return; const list = listRef.current; const travel = list.clientWidth * 0.6 - bar.width; if (travel > 0) list.scrollLeft = barDrag.current.left + (event.clientX - barDrag.current.x) * (list.scrollWidth - list.clientWidth) / travel }} onPointerUp={() => { barDrag.current = null }} onPointerCancel={() => { barDrag.current = null }} /></div></div>
    </div>
    {selected && <Modal close={() => setSelected(null)} className="home-story-modal">{(dismiss) => <>
      <button type="button" className="home-story-close" aria-label="닫기" onClick={dismiss}>×</button>
      <div className="story-detail-heading"><span>{selected.category}</span><h2>{selected.title}</h2><p>{selected.meta} · 우수 참여수기 기준</p></div>
      <div className="story-detail-columns">
        <section><h3>실습 내용</h3>{selected.activities.length ? <ul>{selected.activities.map((row) => <li key={row}>{row}</li>)}</ul> : <p>기록된 실습 내용이 없어요.</p>}</section>
        <section><h3>실습 결과</h3>{selected.outcomes.length ? <ul>{selected.outcomes.map((row) => <li key={row}>{row}</li>)}</ul> : <p>기록된 실습 결과가 없어요.</p>}</section>
      </div>
    </>}</Modal>}
  </section>
}

function GuestCta({ openStages }) {
  return <section className="home-cta is-visible"><div className="home-cta-content"><h2>지금 바로 시작해 보세요</h2><button type="button" className="button primary" onClick={openStages}>체험 학생으로 시작</button><p className="home-cta-sub"><Link to="/login">로그인 · 가입</Link></p></div></section>
}

// ── 로그인한 학생 ──
function StudentHome() {
  const codes = useCodes()
  const internship = useRequest(loadInternship)
  const explore = useRequest(loadExplore)
  const exploreMissing = explore.error?.code === 'EXPLORE_NOT_FOUND'
  const hideExplore = exploreMissing && exploreSkipped(internship.data)
  return <>
    <GuestProcess />
    {!hideExplore && <ExploreJobs codes={codes} explore={explore} missing={exploreMissing} />}
    <Stories />
    <section className="home-cta is-visible"><div className="home-cta-content"><h2>지금 바로 신청하세요</h2><Link className="button primary" to="/jobs">직무 찾아보기</Link></div></section>
  </>
}

function Journey({ codes, internship, explore, exploreReady }) {
  const data = internship.data
  return <section className="home-process is-visible"><div className="process-layout">
    <div className="process-copy">
      <div className="process-intro"><p className="process-kicker">내 현장실습 여정</p><p>직무 탐색부터 실습 뒤 커리어까지, 한곳에서 이어서 챙겨요.</p></div>
      <div className="process-guide">
        {internship.loading && !data && <Loading text="내 현장실습 일정을 불러오는 중…" />}
        {internship.error && <ErrorBox error={internship.error} retry={internship.reload} />}
        {data && <JourneySteps data={data} codes={codes} explore={explore} exploreReady={exploreReady} />}
      </div>
    </div>
    <div className="process-image"><img src={processMascot} alt="책상 앞에서 현장실습을 준비하는 마스코트" /></div>
  </div></section>
}

function JourneySteps({ data, codes, explore, exploreReady }) {
  const stages = data.stages ?? []
  const stage = (code) => stages.find((row) => row.code === code)
  const nowStage = stage(data.now)
  const practice = data.placement?.practice
  const states = JOURNEY.map((group) => (group.phases ? groupState(stages, group.phases) : null))
  const nowIndex = states.findIndex((state) => state === 'NOW')
  const heading = nowIndex >= 0 ? `지금은 ${CIRCLED[nowIndex]} ${JOURNEY[nowIndex].title} 단계예요` : states.every((state) => state === null || state === 'DONE') ? '현장실습 일정을 모두 마쳤어요' : '현장실습 일정을 확인해요'

  const steps = JOURNEY.map((group, i) => {
    if (i === 0) {
      const done = Boolean(explore)
      const skipped = !done && exploreSkipped(data)
      return { ...group, cls: done ? 'is-done' : '', mark: done ? '✓' : skipped ? '–' : '1', to: done ? '/explore/result' : '/explore',
        desc: done ? (explore.items?.length ? `맞는 현장실습 ${explore.items.length}곳 · 넓혀 갈 직무` : '이어진 자리 없음 · 다시 탐색할 수 있어요') : skipped ? '탐색 없이 지원했어요 · 지금도 해 볼 수 있어요' : '해 본 일 · 하고 싶은 일로 맞는 현장실습 찾기',
        when: !exploreReady ? '' : done ? `${fmtDate(explore.createdAt)} 완료` : skipped ? '선택 · 건너뜀' : '아직 안 했어요' }
    }
    const state = states[i]
    const cls = state === 'DONE' ? 'is-done' : state === 'NOW' ? 'is-now' : ''
    let desc = group.desc
    let when = ''
    if (group.n === 2) {
      const apply = stage('APPLY')
      when = state === 'DONE' ? (data.placement ? `${data.placement.institution?.name} 매칭` : '완료')
        : state === 'NOW' ? (apply?.state !== 'DONE' ? `${fmtDate(apply?.endsOn, true)} 마감` : `${label(codes, 'stage', data.now)} 중`)
          : `${fmtDate(stage('PICK')?.startsOn)} 시작`
    } else if (group.n === 3) {
      const run = stage('PRACTICE')
      const weeks = practice?.weeks ?? weeksBetween(run?.startsOn, run?.endsOn)
      desc = run ? `${fmtDate(run.startsOn)} ~ ${fmtDate(run.endsOn)}${weeks ? ` · ${weeks}주` : ''}` : '실습 기간'
      if (state === 'DONE') when = '완료'
      else if (state === 'NOW') when = practice && (data.now === 'PRACTICE' || data.now === 'MIDCHECK') ? `${practice.week}주차 / ${practice.weeks}주` : `${label(codes, 'stage', data.now)} 중`
      else when = `${fmtDate(run?.startsOn)} 시작`
    } else {
      when = state === 'DONE' ? '완료' : state === 'NOW' ? `${label(codes, 'stage', data.now)}${nowStage?.startsOn ? ` · ${fmtDate(nowStage.startsOn)}` : ''}` : '실습 뒤'
    }
    return { ...group, cls, mark: state === 'DONE' ? '✓' : String(group.n), desc, when }
  })

  const todo = todoFor(data, explore, codes)
  const next = data.next
  return <>
    <div className="process-heading"><h3>{heading}</h3></div>
    <div className="steps v2-journey">{steps.map((step) => <Link key={step.n} className={`process-step ${step.cls}`} to={step.to}><b>{step.mark}</b><div><h4>{step.title}</h4><p>{step.desc}</p></div><small>{step.when}</small></Link>)}</div>
    {todo && <div className="v2-todo">
      <div><strong>{todo.title}{todo.virtual && <> <VirtualTag /></>}</strong><span>{todo.sub}</span></div>
      {next && <span className="v2-dday" title={`${label(codes, 'stage', next.code)} ${label(codes, 'nextKind', next.kind)} · ${fmtDate(next.on, true)}`}>{label(codes, 'stage', next.code)} {ddayText(next.days)}</span>}
      <Link className="v2-btn" to={todo.to}>{todo.action}</Link>
    </div>}
  </>
}

// 지금 할 일 — #44 응답(일정 · 지망 · 지원서 · 매칭 · 실습 · 마무리 서류)으로 정한다
function todoFor(data, explore, codes) {
  const app = data.application
  const status = app?.status ?? 'NONE'
  const picks = data.picks ?? []
  const ranked = picks.filter((pick) => pick.rank != null)
  const phase = (data.stages ?? []).find((stage) => stage.code === data.now)?.phase
  const placement = data.placement
  const virtual = Boolean(app?.virtual)
  const statusText = studentAppStatus(status)

  if (status === 'FIX_REQUESTED') return { title: '센터가 보완을 요청했어요', sub: app.fixReason ?? '지원서를 고쳐 다시 내 주세요', to: '/apply', action: '지원서 고치기' }
  if (phase === 'APPLY' && (data.now === 'PICK' || data.now === 'APPLY')) {
    if (status === 'NONE' || status === 'DRAFT') {
      if (!explore && picks.length === 0) return { title: '직무 탐색으로 맞는 자리부터 찾아요', sub: '해 본 일 · 하고 싶은 일로 지원할 수 있는 자리 중에서 골라요', to: '/explore', action: '직무 탐색하기' }
      if (picks.length === 0) return { title: '마음에 드는 직무를 담고 1~3지망을 정해요', sub: '정한 지망 순위가 지원서에 그대로 들어가요', to: explore?.items?.length ? '/explore/result' : '/jobs', action: '직무 담으러 가기' }
      if (ranked.length === 0) return { title: '1~3지망을 정해요', sub: `담은 직무 ${picks.length}개 · 정한 순위가 지원서에 그대로 들어가요`, to: '/internship?step=pick', action: '지망 정하기' }
      return { title: '지원서를 내면 지원이 끝나요', sub: `1~3지망 정함 · 지원서 ${statusText}`, to: '/apply', action: status === 'DRAFT' ? '지원서 이어 쓰기' : '지원서 쓰기' }
    }
    return { title: '지원서를 냈어요', sub: `접수번호 ${app.receiptNo ?? '—'} · ${statusText} · 마감 뒤 센터가 매칭해요`, to: '/internship', action: '진행 보기', virtual }
  }
  if (phase === 'APPLY') {
    if (placement) {
      if (placement.notifiedAt) return { title: placement.result === 'PASS' ? '면접에 합격했어요' : '면접 결과가 나왔어요', sub: `${placement.institution?.name} ${placement.title}`, to: '/internship', action: '결과 보기', virtual }
      return { title: `${placement.institution?.name} ${placement.title}에 매칭됐어요`, sub: placement.interview?.at ? `면접 일정이 나왔어요` : '기관이 면접 일정을 알려 주면 여기에 떠요', to: '/internship', action: '진행 보기', virtual }
    }
    if (status === 'SUBMITTED' || status === 'RECEIVED') return { title: '센터가 매칭을 고르는 중이에요', sub: `접수번호 ${app.receiptNo ?? '—'} · ${statusText}`, to: '/internship', action: '진행 보기', virtual }
    return { title: '이번 회차 지원 기간이 끝났어요', sub: '다음 학기 일정은 현장실습지원센터 공지를 확인해요', to: '/internship', action: '일정 보기' }
  }
  if (phase === 'PREPARE' || phase === 'PRACTICE') {
    if (placement?.practice) {
      const plan = placement.practice.currentPlan
      return { title: `실습 ${placement.practice.week}주차예요`, sub: plan ? `${plan.weeks} · ${plan.content}` : `${placement.institution?.name} ${placement.title}`, to: '/internship', action: '이번 주 보기', virtual }
    }
    return { title: `${label(codes, 'stage', data.now)} 단계예요`, sub: placement ? `${placement.institution?.name} ${placement.title}` : '내 현장실습에서 일정을 확인해요', to: '/internship', action: '내 현장실습' }
  }
  if (phase === 'CLOSE') {
    const docs = data.documents
    if (docs && !docs.report) return { title: '수행결과보고서를 내요', sub: '커리어 리포트로 실습 내용을 정리하면 낼 수 있어요', to: '/career', action: '커리어 리포트 쓰기' }
    const left = docs ? ['credit', 'survey'].filter((key) => !docs[key]).map((key) => label(codes, 'studentDocument', key.toUpperCase())) : []
    if (left.length) return { title: '마무리 서류를 마저 내요', sub: `남은 서류 · ${left.join(' · ')}`, to: '/internship', action: '마무리 서류', virtual }
    return { title: '마무리 서류를 다 냈어요', sub: '실습으로 채운 역량과 넓혀 갈 직무를 확인해요', to: '/career', action: '커리어 리포트' }
  }
  return null
}

function ExploreJobs({ codes, explore, missing }) {
  const navigate = useNavigate()
  const data = explore.data
  const items = (data?.items ?? []).slice(0, 4)
  const plan = useRequest(loadPlan, items.length > 0)
  const [busyJob, setBusyJob] = useState(null)
  const [message, setMessage] = useState('')
  const plannedIds = new Set((plan.data?.items ?? []).map((item) => item.jobId))
  const toggle = async (item) => {
    if (busyJob || !plan.data) return
    const saved = plannedIds.has(item.jobId)
    setBusyJob(item.jobId); setMessage('')
    try {
      const current = plan.data.items ?? []
      if (saved) { await removePlanItem(item.jobId); plan.mutate({ ...plan.data, items: current.filter((x) => x.jobId !== item.jobId) }) }
      else { await addPlanItem(item.jobId); plan.mutate({ ...plan.data, items: [...current, { jobId: item.jobId, title: item.title, institution: item.institution, rank: null }] }) }
    } catch (error) {
      setMessage(planErrorMessage(error, saved ? '빼기' : '담기'))
    } finally {
      setBusyJob(null)
    }
  }
  const go = (item) => navigate(`/jobs/${item.jobId}`)

  return <section className="home-jobs is-visible is-settled"><div className="home-jobs-layout">
    <MascotVideo />
    <div className="home-jobs-content">
      <div className="home-section-heading"><h2 className="job-title-message">직무 탐색으로 찾은 현장실습</h2>{data && <p className="home-jobs-sub">{fmtDate(data.createdAt)} 탐색 · {data.source === 'RULE' ? '규칙 추천으로 대신한 결과예요' : '해 본 일 · 고른 일과 이어진 자리예요'}</p>}</div>
      {explore.loading && !data && <Loading text="탐색 결과를 불러오는 중…" />}
      {explore.error && !missing && <ErrorBox error={explore.error} retry={explore.reload} />}
      {missing && <div className="home-explore-empty">
        <b>아직 직무 탐색을 하지 않았어요</b>
        <p>해 본 일 1개, 또는 하고 싶은 일 3개를 고르면 지원할 수 있는 자리 중에서 나에게 이어지는 곳을 원문 근거와 함께 찾아 줘요. 5~15초 걸려요.</p>
        <Link className="v2-btn" to="/explore">직무 탐색하러 가기 →</Link>
      </div>}
      {data && items.length === 0 && <div className="home-explore-empty">
        <b>이어진 근거가 있는 자리가 없었어요</b>
        <p>해 본 일을 더 구체적으로 적거나 하고 싶은 일을 더 골라 다시 탐색해 보세요.</p>
        <div className="fx-row"><Link className="v2-btn gray" to="/explore/result">결과 보기</Link><Link className="v2-btn" to="/explore">다시 탐색하기 →</Link></div>
      </div>}
      {message && <p className="home-job-message" role="alert">{message}</p>}
      {items.length > 0 && <div className="home-job-list">{items.map((item) => {
        const saved = plannedIds.has(item.jobId)
        return <article key={item.jobId} className="home-job-row" role="link" tabIndex={0} onClick={() => go(item)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); go(item) } }}>
          <div>
            <div className="home-job-company"><InstitutionLogo institution={item.institution} className="home-institution-logo" /><div className="home-job-company-info"><div className="home-job-badges"><span className={item.verdict === 'ELIGIBLE' ? 'is-available' : 'is-check'}>{VERDICT_LABEL[item.verdict] ?? item.verdict}</span><span>{label(codes, 'exploreFit', item.fit)}</span></div><small>{item.institution?.name}</small></div></div>
            <h3>{item.title}</h3>
            <p className="job-description">{item.evidence?.reason}</p>
            <div className="job-meta"><span>{item.rank}위{item.team ? ` · ${item.team}` : ''}</span><span>{item.links?.length ? `이어진 짝 ${item.links.length}개` : '규칙 추천'}</span></div>
            <div className="home-job-actions recommend-card-bottom">
              <button type="button" className="reason-button" onClick={(event) => { event.stopPropagation(); navigate('/explore/result') }}>왜 맞는지 보기</button>
              <button type="button" className={`recommend-save-button ${saved ? 'saved' : ''}`} disabled={busyJob === item.jobId || !plan.data} title={saved ? '다시 누르면 담기를 취소해요' : undefined} onClick={(event) => { event.stopPropagation(); toggle(item) }}>{busyJob === item.jobId ? '…' : saved ? '담김' : '담기'}</button>
            </div>
          </div>
        </article>
      })}</div>}
    </div>
  </div>
  <Link className="section-more" to={data ? '/explore/result' : '/jobs'}>{data ? '탐색 결과 전체 보기' : '현장실습 전체 보기'} <span aria-hidden="true">→</span></Link>
  </section>
}
