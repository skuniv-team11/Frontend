import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { getExploreCards, getMyExplore, runExplore } from '../../api/explore'
import { getMyProfile, toProfileBody } from '../../api/me'
import { getCertificates } from '../../api/reference'
import { ErrorBox, Loading, NeedLogin } from '../../components/v2'
import { LoginRequired } from '../../components/LoginRequired'
import { useRequest } from '../../hooks/useRequest'
import { useSession } from '../../hooks/useSession'
import './Explore.css'
import { josa } from '../../lib/josa'

const MIN = 20
const MAX = 200
const MAX_EXPS = 3
const MAX_CARDS = 5
const CARD_PAGE_SIZE = 9
const WISH_MAX = 200 // 프로필 관심 분야와 같은 한도

const loadProfile = (signal) => getMyProfile(signal)
const loadCards = (signal) => getExploreCards(signal) // 저장한 프로필로 본다(profile을 보내지 않음)
const loadLast = (signal) => getMyExplore(signal)
const loadCertificates = (signal) => getCertificates(signal)

// 탐색 중 4단계(프로토타입 ex-run) — 실제 진행을 알 수 없어 걸린 시간으로 넘기고, 응답이 오면 모두 끝낸다
const runSteps = ['지원 조건 확인', '내 글과 업무의 짝 찾기', '근거 확인 · 순서', '저장']
const clock = () => Date.now() // 누를 때(이벤트)만 부른다
const stepAt = (seconds) => (seconds < 0.8 ? 0 : seconds < 6 ? 1 : seconds < 10 ? 2 : 3)

function ExperienceRow({ children, closing }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div className={`ex-exp-motion ${visible && !closing ? 'is-open' : ''}`}><div>{children}</div></div>
}

export function ExplorePage() {
  const session = useSession()
  if (!session.loggedIn) return <LoginRequired title="나에게 맞는 현장실습을 탐색해 보세요" destination="/explore" />
  if (session.me && !session.isStudent) return <NeedLogin />
  return <ExploreScreen />
}

function ExploreScreen() {
  const navigate = useNavigate()
  const profile = useRequest(loadProfile)
  const hasProfile = Boolean(profile.data)
  const cards = useRequest(loadCards, hasProfile)
  const last = useRequest(loadLast)
  const certificates = useRequest(loadCertificates).data

  const [exps, setExps] = useState([''])
  const [removingExp, setRemovingExp] = useState(null)
  const removeTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(removeTimer.current), [])
  const removeExp = (index) => {
    if (removingExp !== null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setExps((current) => current.filter((_, i) => i !== index))
      return
    }
    setRemovingExp(index)
    removeTimer.current = window.setTimeout(() => {
      setExps((current) => current.filter((_, i) => i !== index))
      setRemovingExp(null)
    }, 300)
  }
  const [picked, setPicked] = useState([])
  const [visibleCardCount, setVisibleCardCount] = useState(CARD_PAGE_SIZE)
  const [consent, setConsent] = useState(false)
  // 직접 적은 관심 분야는 이번 탐색에만 사용한다.
  const [wish, setWish] = useState('')
  const [run, setRun] = useState(null) // { startedAt, now, finishedAt }
  const [runLeaving, setRunLeaving] = useState(false)
  const [runError, setRunError] = useState(null)
  const splitRef = useRef(null)
  const [asideTop, setAsideTop] = useState(null)
  useLayoutEffect(() => {
    const alignAside = () => {
      if (splitRef.current) setAsideTop(splitRef.current.getBoundingClientRect().top + window.scrollY)
    }
    alignAside()
    window.addEventListener('resize', alignAside)
    return () => window.removeEventListener('resize', alignAside)
  }, [hasProfile, run, runError])
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, []) // StrictMode에서 다시 붙을 때도 true로

  // 탐색 중 시계(단계 표시용)
  const running = Boolean(run && !run.finishedAt)
  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => setRun((current) => (current && !current.finishedAt ? { ...current, now: Date.now() } : current)), 250)
    return () => window.clearInterval(timer)
  }, [running])
  // 끝나면 잠깐 4단계 완료를 보여 주고 결과로
  useEffect(() => {
    if (!run?.finishedAt) return undefined
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leaveTimer = window.setTimeout(() => setRunLeaving(true), 900)
    const navigateTimer = window.setTimeout(() => navigate('/explore/result'), reducedMotion ? 900 : 1350)
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(navigateTimer) }
  }, [run?.finishedAt, navigate])

  const lastResult = last.data
  const cardList = useMemo(() => cards.data?.cards ?? [], [cards.data])

  const filled = exps.map((text) => text.trim())
  const validExps = filled.filter((text) => text.length >= MIN)
  const shortIndex = filled.findIndex((text) => text.length > 0 && text.length < MIN)
  const savedWish = profile.data?.interestText ?? ''
  const wishText = wish.slice(0, WISH_MAX)
  const enough = validExps.length > 0 || picked.length >= 3
  const canRun = enough && shortIndex < 0 && consent && !run

  let need
  if (shortIndex >= 0) need = `경험 ${shortIndex + 1}${josa(String(shortIndex + 1), '은/는')} ${MIN}자 이상 적어 주세요(지금 ${filled[shortIndex].length}자)`
  else if (!enough) need = ''
  else if (!consent) need = '아래 동의에 체크하면 탐색할 수 있어요'
  else need = `해 본 일 ${validExps.length}개 · 고른 일 ${picked.length}개${wishText.trim() ? ' · 직접 적은 글' : ''}로 찾아요`

  const setExp = (index, value) => setExps((current) => current.map((text, i) => (i === index ? value.slice(0, MAX) : text)))
  const togglePick = (id) => setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_CARDS ? current : [...current, id]))

  // 지난 탐색 글 불러오기(저장된 경험 글은 번호 모양이 [가림]으로 바뀌어 있다). 카드는 글이 같은 카드를 다시 고른다
  const loadPrevious = () => {
    const input = lastResult?.input
    if (!input) return
    const prevExps = (input.experiences ?? []).slice(0, MAX_EXPS)
    setExps(prevExps.length ? prevExps : [''])
    const ids = (input.cards ?? []).map((text) => cardList.find((card) => card.text === text)?.id).filter(Boolean)
    setPicked([...new Set(ids)].slice(0, MAX_CARDS))
    if (input.interestText) setWish(input.interestText.slice(0, WISH_MAX))
  }

  const start = async () => {
    if (!canRun) return
    // 적은 글이 프로필 관심 분야와 다르면 이번 탐색에만 바꿔 보낸다(나머지 값은 저장한 프로필 그대로)
    const typed = wishText.trim()
    const profileBody = typed !== savedWish.trim() ? { ...toProfileBody(profile.data), interestText: typed || null } : undefined
    setRunError(null)
    const startedAt = clock()
    setRunLeaving(false)
    setRun({ startedAt, now: startedAt, finishedAt: null })
    try {
      await runExplore({ experiences: validExps, cardIds: picked, profile: profileBody })
      if (!alive.current) return
      setRun((current) => ({ ...current, now: Date.now(), finishedAt: Date.now() }))
    } catch (error) {
      if (!alive.current) return
      setRun(null)
      setRunError(error)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const head = <div className="ex-head">
    <header className="page-title"><span>JOB EXPLORE · AI</span><h1>해 본 일과 하고 싶은 일로 나에게 맞는 현장실습을 찾아요</h1></header>
    {lastResult && !run && createPortal(<Link className="ex-result-float" to="/explore/result"><span className="ex-result-float-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></svg></span><span>지난 탐색<br />결과 보기</span></Link>, document.body)}
  </div>

  if (profile.loading) return <main className="fx-page"><div className="fx-shell">{head}<Loading note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." /></div></main>
  if (profile.error) {
    const noProfile = profile.error.code === 'PROFILE_NOT_FOUND'
    return <main className="fx-page"><div className="fx-shell">{head}
      {noProfile
        ? <div className="fx-card v2-state is-empty"><b>프로필부터 저장해 주세요</b><p>학과 · 학년 · 이수 학기 · 평점 · 자격증으로 지원할 수 있는 자리를 먼저 거른 뒤 탐색해요.<br />저장한 프로필이 있어야 결과를 다시 열어도 같은 기준으로 판정돼요.</p><Link className="fx-btn primary" to="/me" state={{ editProfile: true }}>프로필 저장하러 가기 →</Link></div>
        : <ErrorBox error={profile.error} retry={profile.reload} />}
    </div></main>
  }

  if (run) {
    const seconds = ((run.finishedAt ?? run.now) - run.startedAt) / 1000
    const current = run.finishedAt ? 4 : stepAt(seconds)
    return <main className="fx-page"><div className={`fx-shell ex-run-layout ${runLeaving ? 'is-leaving' : ''}`}>{head}
      <section className="fx-card ex-run" aria-live="polite">
        <span className="fx-kicker">{run.finishedAt ? '탐색 끝' : '탐색 중'}</span>
        <h2 className="fx-h2">{run.finishedAt ? '탐색을 완료했어요' : '지원할 수 있는 자리와 내 글을 맞춰 보고 있어요'}</h2>
        <div style={{ marginTop: 14 }}>{runSteps.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'wait'
          return <div key={label} className={`ex-step ${state}`}><i>{i + 1}</i><b>{label}</b>{state === 'now' ? <span className="ex-step-spinner" role="status" aria-label="진행 중" /> : state === 'done' ? <span className="ex-step-check" aria-label="완료">✓</span> : null}</div>
        })}</div>
        <div className="ex-run-foot">
          <span className="fx-small">{run.finishedAt ? `${seconds.toFixed(1)}초 · 인용 구절이 원문에 그대로 있는 짝만 남겼어요` : seconds < 20 ? `${Math.floor(seconds)}초 지났어요 · 보통 5~15초 걸려요` : `${Math.floor(seconds)}초 지났어요 · 서버가 잠들어 있었거나 AI 응답이 늦으면 1~2분 걸릴 수 있어요. 조금만 기다려 주세요`}</span>
        </div>
      </section>
    </div></main>
  }

  const p = profile.data
  const certLabel = (code) => certificates?.certificates?.find((c) => c.code === code)?.label ?? code
  const availableCards = cardList.slice(0, visibleCardCount)
  const cardButton = (card) => {
    const on = picked.includes(card.id)
    return <button key={card.id} type="button" className={`ex-w ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && picked.length >= MAX_CARDS} onClick={() => togglePick(card.id)}><b>{card.text}</b><small>{on ? '✓ 고름' : ''}</small></button>
  }

  return <main className="fx-page"><div className="fx-shell">{head}
    {runError && <div className="fx-callout warn ex-error" role="alert"><span className="fx-callout-icon">!</span><div><b>탐색하지 못했어요.</b> {errorMessage(runError)}
      {(runError.code === 'NETWORK' || runError.status >= 500) && <> 응답을 받기 전에 연결이 끊겼다면 서버에는 결과가 저장됐을 수 있어요. <Link className="v2-link" to="/explore/result">결과 확인하기 →</Link></>}</div></div>}
    <div className="fx-split wide-side" ref={splitRef}>
      <div className="fx-stack">
        <section className="fx-card ex-card">
          <div className="fx-row between">
            <h2 className="fx-h2" style={{ margin: 0 }}>해 본 일<span className="ex-tag">AI가 읽어요</span></h2>
            {(lastResult?.input?.experiences?.length > 0 || lastResult?.input?.cards?.length > 0) && <button type="button" className="ex-load-prev" onClick={loadPrevious}>지난 탐색 글 불러오기</button>}
          </div>
          <div className="v2-exp">
            {exps.map((text, i) => {
              const short = text.trim().length > 0 && text.trim().length < MIN
              return <ExperienceRow key={i} closing={removingExp === i}><label>
                <span className="ex-exp-head"><span>경험 {i + 1}</span><span><span className={short ? 'is-short' : ''}>{text.length} / {MAX}자{short ? ` · ${MIN}자 이상` : ''}</span>{exps.length > 1 && <button type="button" aria-label={`경험 ${i + 1} 삭제`} disabled={removingExp !== null} onClick={(event) => { event.preventDefault(); removeExp(i) }}>×</button>}</span></span>
                <textarea aria-label={`경험 ${i + 1}`} value={text} maxLength={MAX} placeholder={i === 0 ? '예) 학과 행사 인스타그램 콘텐츠를 만들었어요.' : ''} onChange={(event) => setExp(i, event.target.value)} />
              </label></ExperienceRow>
            })}
            {exps.length < MAX_EXPS && <button type="button" className="v2-add" disabled={removingExp !== null} onClick={() => setExps((current) => [...current, ''])}>＋ 하나 더 적기 (최대 {MAX_EXPS}개)</button>}
          </div>
          <div className="v2-privacy"><span><i>!</i>이름 · 연락처 · 학번은 쓰지 마세요</span><span><i>✓</i>AI에는 경험 글 · 고른 일 · 관심 분야만 보내요</span></div>
        </section>

        <section className="fx-card ex-card">
          <h2 className="fx-h2" style={{ margin: 0 }}>해 보고 싶은 일</h2>
          {cards.loading && !cards.data && <Loading text="하고 싶은 일 카드를 불러오는 중…" />}
          {cards.error && <ErrorBox error={cards.error} retry={cards.reload} />}
          {cards.data && <>
            <label className="ex-wish">
              <span className="ex-exp-head"><span>직접 적기 · 관심 분야</span><span>{wishText.length} / {WISH_MAX}자</span></span>
              <input className="fx-input" aria-label="하고 싶은 일 직접 적기" value={wishText} maxLength={WISH_MAX} placeholder="예) 뷰티 브랜드 SNS 마케팅" onChange={(event) => setWish(event.target.value)} />
            </label>
            {cardList.length === 0
              ? <p className="rs-empty-why" style={{ marginTop: 14 }}>지원 조건을 맞춘 자리가 없어 고를 카드가 없어요. 프로필의 학년 · 이수 학기 · 평점 · 자격증을 확인해 주세요.</p>
              : <>
                <p className="ex-want-count">{picked.length} / {MAX_CARDS} 고름</p>
                <div className="ex-want">{availableCards.map(cardButton)}</div>
                {visibleCardCount < cardList.length && <button type="button" className="ex-more" onClick={() => setVisibleCardCount((count) => count + CARD_PAGE_SIZE)}>더 보기</button>}
                <p className="fx-small" style={{ margin: '8px 0 0' }}>회사 이름은 가리고, 겹치는 일은 하나로 묶었어요. 찾는 일이 없으면 위 칸에 직접 적어 주세요.</p>
              </>}
          </>}
        </section>
      </div>

      {createPortal(<aside className="fx-aside ex-sticky-aside" style={asideTop == null ? undefined : { top: asideTop }}>
        <section className="fx-card tight ex-side"><h3>학과</h3><p className="ex-department">{p.department?.name ?? '학과 정보 없음'}</p></section>
        <section className="fx-card tight ex-side"><h3>지원 조건 확인</h3>
          <dl className="ex-profile-values">
            <div><dt>학년 · 이수 학기</dt><dd>{p.grade}학년 · {p.completedSemesters}학기</dd></div>
            <div><dt>평점</dt><dd>{Number(p.gpa).toFixed(1)}</dd></div>
            <div><dt>자격증</dt><dd>{p.certificates?.length ? p.certificates.map(certLabel).join(' · ') : '없음'}</dd></div>
          </dl>
        </section>
        <label className={`ex-consent ${consent ? '' : 'off'}`}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>내 경험을 분석하고 결과와 함께 저장하는 데 동의해요.</span>
        </label>
        <button type="button" className="fx-btn primary lg block" disabled={!canRun} onClick={start}>탐색하기</button>
        {need && <p className={`ex-need ${shortIndex >= 0 ? 'warn' : ''}`}>{need}</p>}
      </aside>, document.body)}
    </div>
  </div></main>
}
