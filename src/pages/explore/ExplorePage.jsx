import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { getExploreCards, getMyExplore, runExplore } from '../../api/explore'
import { getMyProfile, toProfileBody } from '../../api/me'
import { getCertificates } from '../../api/reference'
import { ErrorBox, Loading, NeedLogin } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useSession } from '../../hooks/useSession'
import { fmtDate } from '../../lib/format'
import './Explore.css'
import { josa } from '../../lib/josa'

const MIN = 20
const MAX = 200
const MAX_EXPS = 3
const MAX_CARDS = 5
const CARDS_FIRST = 6 // 대표 카드 — 서버가 선호 전공 자리부터, 자리를 번갈아 놓은 순서의 앞쪽(ADR-0039)
const WISH_MAX = 200 // 프로필 관심 분야와 같은 한도
const SUGGEST_MAX = 3 // 같은 말이 많이 겹친 순서로 3개(대표 6개와 합쳐 3줄)

// 직접 적은 '하고 싶은 일'과 같은 말이 들어간 카드 — 낱말 끝 조사를 떼고 카드 글에 들어 있는지만 본다(뜻이 비슷한 말은 AI가 잇는다)
const PARTICLE = /(에서|으로|이랑|하고|하기|하는|관련|을|를|이|가|은|는|에|로|와|과|의|도|랑)$/
const STOP = new Set(['해보고', '보고', '싶어요', '싶은', '싶다', '싶어', '하고', '해요', '업무', '관련', '분야'])
const wishWords = (text) => [...new Set(String(text ?? '').split(/[\s,·/()]+/).map((w) => w.replace(PARTICLE, '')).filter((w) => w.length >= 2 && !STOP.has(w)))]
function suggestCards(cards, text, exclude) {
  const words = wishWords(text)
  if (!words.length) return []
  return cards
    .map((card, order) => ({ card, order, score: words.filter((w) => card.text.includes(w)).length }))
    .filter((row) => row.score > 0 && !exclude.has(row.card.id))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, SUGGEST_MAX)
    .map((row) => row.card)
}

const loadProfile = (signal) => getMyProfile(signal)
const loadCards = (signal) => getExploreCards(signal) // 저장한 프로필로 본다(profile을 보내지 않음)
const loadLast = (signal) => getMyExplore(signal)
const loadCertificates = (signal) => getCertificates(signal)

// 탐색 중 4단계(프로토타입 ex-run) — 실제 진행을 알 수 없어 걸린 시간으로 넘기고, 응답이 오면 모두 끝낸다
const runSteps = (total) => [
  ['지원 조건 확인', total === 0 ? '지원할 수 있는 자리가 없어 AI는 부르지 않고, 무엇이 막았는지 세어요' : `지원 불가 · 마감 자리는 처음부터 빼고, 지원할 수 있는 ${total ?? ''}곳만 넘겨요`, '규칙', 'fx-who rule'],
  ['내 글과 업무의 짝 찾기', '해 본 일 · 고른 일 · 관심 분야를 자리마다 하는 일 · 요구 역량 · 주차 계획과 읽고, 같은 일 · 해 본 일이 쓰이는 일 · 하고 싶은 일로 짝을 지어요', 'AI', 'fx-who ai'],
  ['근거 확인 · 순서', '인용 구절이 내 글과 공고 원문에 그대로 있는지 확인하고, 순서는 근거 단계 → 선호 전공 → 짝 수로 정해요', '코드 · 규칙', 'fx-who rule'],
  ['저장', "맞는 순서와 상위 3곳 '왜 맞나요'를 저장해요 · 볼 때마다 다시 계산하지 않아요", '저장', 'fx-who rule'],
]
const clock = () => Date.now() // 누를 때(이벤트)만 부른다
const stepAt = (seconds) => (seconds < 0.8 ? 0 : seconds < 6 ? 1 : seconds < 10 ? 2 : 3)

export function ExplorePage() {
  const session = useSession()
  if (!session.loggedIn) return <NeedLogin />
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
  const [picked, setPicked] = useState([])
  const [consent, setConsent] = useState(false)
  // 직접 적는 '하고 싶은 일' — 프로필 관심 분야로 미리 채우고, 이번 탐색에서만 관심 분야로 AI에 보낸다(저장한 프로필은 그대로)
  const [wish, setWish] = useState(null)
  const [run, setRun] = useState(null) // { startedAt, now, finishedAt }
  const [runError, setRunError] = useState(null)
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
    const timer = window.setTimeout(() => navigate('/explore/result'), 1400)
    return () => window.clearTimeout(timer)
  }, [run?.finishedAt, navigate])

  const lastResult = last.data
  const candidates = cards.data?.candidates
  const cardList = useMemo(() => cards.data?.cards ?? [], [cards.data])

  const filled = exps.map((text) => text.trim())
  const validExps = filled.filter((text) => text.length >= MIN)
  const shortIndex = filled.findIndex((text) => text.length > 0 && text.length < MIN)
  const savedWish = profile.data?.interestText ?? ''
  const wishText = (wish ?? savedWish).slice(0, WISH_MAX)
  const enough = validExps.length > 0 || picked.length >= 3
  const canRun = enough && shortIndex < 0 && consent && !run

  let need
  if (shortIndex >= 0) need = `경험 ${shortIndex + 1}${josa(String(shortIndex + 1), '은/는')} ${MIN}자 이상 적어 주세요(지금 ${filled[shortIndex].length}자)`
  else if (!enough) need = '해 본 일 1개, 또는 하고 싶은 일 카드 3개 이상이면 찾을 수 있어요 · 직접 적은 글은 함께 읽어요'
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
    <header className="page-title"><span>JOB EXPLORE · AI</span><h1>해 본 일과 하고 싶은 일로 나에게 맞는 현장실습을 찾아요</h1><p>지원 조건을 맞춘 자리 중에서 고르고, 실습 뒤 넓혀 갈 직무와 일자리까지 보여 줘요.</p></header>
    {lastResult && !run && <Link className="v2-link" to="/explore/result">지난 탐색 {fmtDate(lastResult.createdAt)} · 결과 보기 →</Link>}
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
    return <main className="fx-page"><div className="fx-shell">{head}
      <section className="fx-card ex-run" aria-live="polite">
        <span className="fx-kicker">{run.finishedAt ? '탐색 끝' : '탐색 중'}</span>
        <h2 className="fx-h2">{run.finishedAt ? '결과를 저장했어요. 결과 화면으로 넘어가요' : '지원할 수 있는 자리와 내 글을 맞춰 보고 있어요'}</h2>
        <div style={{ marginTop: 14 }}>{runSteps(candidates?.total).map(([label, sub, who, whoCls], i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'wait'
          return <div key={label} className={`ex-step ${state}`}><i>{state === 'done' ? '✓' : i + 1}</i><span><b>{label}</b><small>{sub}</small></span><span className={whoCls}>{who}</span></div>
        })}</div>
        <div className="ex-run-foot">
          <span className="fx-small">{run.finishedAt ? `${seconds.toFixed(1)}초 · 인용 구절이 원문에 그대로 있는 짝만 남겼어요` : seconds < 20 ? `${Math.floor(seconds)}초 지났어요 · 보통 5~15초 걸려요` : `${Math.floor(seconds)}초 지났어요 · 서버가 잠들어 있었거나 AI 응답이 늦으면 1~2분 걸릴 수 있어요. 조금만 기다려 주세요`}</span>
          {run.finishedAt && <Link className="fx-btn primary" to="/explore/result">결과 보기 →</Link>}
        </div>
      </section>
    </div></main>
  }

  const p = profile.data
  const certLabel = (code) => certificates?.certificates?.find((c) => c.code === code)?.label ?? code
  const visibleCards = cardList.filter((card, i) => i < CARDS_FIRST || picked.includes(card.id))
  const suggested = suggestCards(cardList, wishText, new Set(visibleCards.map((card) => card.id)))
  const cardButton = (card) => {
    const on = picked.includes(card.id)
    return <button key={card.id} type="button" className={`ex-w ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && picked.length >= MAX_CARDS} onClick={() => togglePick(card.id)}><b>{card.text}</b><small>{on ? '✓ 고름' : ''}</small></button>
  }

  return <main className="fx-page"><div className="fx-shell">{head}
    {runError && <div className="fx-callout warn ex-error" role="alert"><span className="fx-callout-icon">!</span><div><b>탐색하지 못했어요.</b> {errorMessage(runError)}
      {(runError.code === 'NETWORK' || runError.status >= 500) && <> 응답을 받기 전에 연결이 끊겼다면 서버에는 결과가 저장됐을 수 있어요. <Link className="v2-link" to="/explore/result">결과 확인하기 →</Link></>}</div></div>}
    <div className="fx-split wide-side">
      <div className="fx-stack">
        <section className="fx-card ex-card">
          <div className="fx-row between">
            <h2 className="fx-h2" style={{ margin: 0 }}>해 본 일<span className="ex-tag">AI가 읽어요</span></h2>
            {(lastResult?.input?.experiences?.length > 0 || lastResult?.input?.cards?.length > 0) && <button type="button" className="ex-load-prev" onClick={loadPrevious}>지난 탐색 글 불러오기</button>}
          </div>
          <p className="fx-sub" style={{ margin: '6px 0 0' }}>수업 · 동아리 · 아르바이트 모두 좋아요. 무엇을 어떻게 했는지, 결과가 있으면 같이 써 주세요. 하나에 {MIN}~{MAX}자예요.</p>
          <div className="v2-exp">
            {exps.map((text, i) => {
              const short = text.trim().length > 0 && text.trim().length < MIN
              return <label key={i}>
                <span className="ex-exp-head"><span>경험 {i + 1}</span><span><span className={short ? 'is-short' : ''}>{text.length} / {MAX}자{short ? ` · ${MIN}자 이상` : ''}</span>{exps.length > 1 && <button type="button" onClick={(event) => { event.preventDefault(); setExps((current) => current.filter((_, j) => j !== i)) }}>빼기</button>}</span></span>
                <textarea aria-label={`경험 ${i + 1}`} value={text} maxLength={MAX} placeholder={i === 0 ? '예) 학과 행사 홍보용 인스타그램 계정을 운영하면서 게시 시간을 바꿔 가며 반응을 비교했어요.' : ''} onChange={(event) => setExp(i, event.target.value)} />
              </label>
            })}
            {exps.length < MAX_EXPS && <button type="button" className="v2-add" onClick={() => setExps((current) => [...current, ''])}>＋ 하나 더 적기 (최대 {MAX_EXPS}개)</button>}
          </div>
          <div className="v2-privacy"><span><i>!</i>이름 · 연락처 · 학번은 쓰지 마세요</span><span><i>✓</i>AI에는 경험 글 · 고른 일 · 관심 분야만 보내요</span></div>
          <p className="ex-privacy-note">전화번호 · 이메일 · 학번 같은 번호 모양은 서버가 [가림]으로 바꾼 뒤 AI에 보내고 저장해요. 이름은 가려지지 않으니 직접 빼 주세요.</p>
        </section>

        <section className="fx-card ex-card">
          <div className="fx-row between"><h2 className="fx-h2" style={{ margin: 0 }}>해 보고 싶은 일<span className="ex-tag opt">{picked.length} / {MAX_CARDS} 고름</span></h2><span className="fx-small">직접 적거나 골라요 · 해 본 일과 함께 AI가 읽어요</span></div>
          {cards.loading && !cards.data && <Loading text="하고 싶은 일 카드를 불러오는 중…" />}
          {cards.error && <ErrorBox error={cards.error} retry={cards.reload} />}
          {cards.data && <>
            <label className="ex-wish">
              <span className="ex-exp-head"><span>직접 적기 · 관심 분야</span><span>{wishText.length} / {WISH_MAX}자</span></span>
              <input className="fx-input" aria-label="하고 싶은 일 직접 적기" value={wishText} maxLength={WISH_MAX} placeholder="예) 뷰티 브랜드 SNS 마케팅, 상품 기획, 패키지 디자인" onChange={(event) => setWish(event.target.value)} />
              <small>{wish !== null && wishText.trim() !== savedWish.trim() ? '이번 탐색에만 관심 분야로 써요 · 저장한 프로필은 그대로예요' : savedWish ? '프로필의 관심 분야를 넣어 뒀어요 · 고치면 이번 탐색에만 써요' : '적은 글은 AI가 지원할 수 있는 자리의 하는 일과 이어 봐요'}</small>
            </label>
            {cardList.length === 0
              ? <p className="rs-empty-why" style={{ marginTop: 14 }}>지원 조건을 맞춘 자리가 없어 고를 카드가 없어요. 프로필의 학년 · 이수 학기 · 평점 · 자격증을 확인해 주세요.</p>
              : <>
                {wishWords(wishText).length > 0 && <>
                  <p className="ex-want-label">적은 글과 같은 말이 들어간 일 {suggested.length ? `${suggested.length}개` : ''}</p>
                  {suggested.length > 0
                    ? <div className="ex-want">{suggested.map(cardButton)}</div>
                    : <p className="fx-small" style={{ margin: '6px 0 0' }}>같은 말이 들어간 일이 없어요. 적은 글은 그대로 AI가 읽고 뜻이 이어지는 자리를 찾아요.</p>}
                </>}
                <p className="ex-want-label">대표로 고른 일 · 지원 조건을 맞춘 {candidates?.total ?? 0}개 자리의 운영계획서에서</p>
                <div className="ex-want">{visibleCards.map(cardButton)}</div>
                <p className="fx-small" style={{ margin: '8px 0 0' }}>회사 이름은 가리고, 겹치는 일은 하나로 묶었어요. 찾는 일이 없으면 위 칸에 직접 적어 주세요.</p>
              </>}
          </>}
        </section>
      </div>

      <aside className="fx-aside">
        <section className="fx-card tight ex-side"><h3>학과<small>프로필에서</small></h3><div className="ex-chips"><span className="ex-chip major">{p.department?.name ?? '학과 정보 없음'} · {p.grade}학년</span></div></section>
        <section className="fx-card tight ex-side"><h3>지원 조건 확인<small>프로필에서</small></h3>
          <div className="ex-chips">
            <span className="ex-chip major">{p.grade}학년 · {p.completedSemesters}학기 이수</span>
            <span className="ex-chip major">평점 {Number(p.gpa).toFixed(1)}</span>
            <span className="ex-chip major">{p.certificates?.length ? p.certificates.map(certLabel).join(' · ') : '자격증 없음'}</span>
            {p.graduationExpected && <span className="ex-chip major">졸업예정</span>}
          </div>
          <p className="fx-small" style={{ margin: '8px 0 0' }}>학년 · 학점 · 자격증을 못 맞춘 자리와 마감된 자리는 처음부터 빼고 찾아요. <b>이 값은 AI에 보내지 않아요.</b></p>
        </section>
        <label className={`ex-consent ${consent ? '' : 'off'}`}>
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>경험 글 · 고른 일 · 직접 적은 글을 AI(Claude)에 보내 분석하고, 결과와 함께 저장하는 데 동의해요. 계정당 마지막 1건만 두고, [결과 지우기]나 탈퇴하면 바로 지워요.</span>
        </label>
        <button type="button" className="fx-btn primary lg block" disabled={!canRun} onClick={start}>탐색하기</button>
        <p className={`ex-need ${shortIndex >= 0 ? 'warn' : ''}`}>{need}</p>
        <p className="fx-small" style={{ margin: 0, textAlign: 'center' }}>약 5~15초 · 결과는 직무 찾기 추천에 쓰여요</p>
      </aside>
    </div>
  </div></main>
}
