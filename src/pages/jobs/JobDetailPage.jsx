import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { resolveApiAssetUrl } from '../../api/client'
import { getCachedExploreWhy, getExploreWhy, getMyExplore } from '../../api/explore'
import { getCommute, getJob, getJobCareer } from '../../api/jobs'
import { getMyProfile } from '../../api/me'
import { addPlanItem, planErrorMessage, removePlanItem } from '../../api/plan'
import { getCurrentRound, label } from '../../api/reference'
import { Badge, Toast } from '../../components/Shell'
import { Empty, InstitutionLogo, VerdictBadge } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes, useSession } from '../../hooks/useSession'
import { requestScrollRestore } from '../../layout/scrollPosition'
import { fmtDate, won, MAJOR_LABEL } from '../../lib/format'
import './JobDetailPage.css'
import './JobDetailV2.css'

// 직무 상세(S4) — #17 상세 · #32 '왜 나에게 맞나요'(AI) · #33 이어지는 길 · #18 통근 · #20/#21 담기
const SECTIONS = [['job-requirements', '지원 조건'], ['job-overview', '하는 일'], ['job-conditions', '실습 조건'], ['job-evidence', '공고 정보'], ['job-institution', '기관 정보']]
const UNIT_PREVIEW = 4
const SCHOOL_RULE_NOTE = '학교 규정(2026-2 학생 모집안내): 4학기 이상 이수 · 졸업예정자는 방학 과정 불가. 휴학·수료·학사학위취득유예·대학원생, 현장실습 학점 18학점 초과, 재직 중, 부정 실습 제재 이력이 있으면 참여할 수 없어요.'
const NCS_SOURCE = 'NCS 능력단위(한국산업인력공단, 2026-09-30 적재) · 직업 연계: 한국고용정보원 직업능력 코드매핑정보(2025-11-26)'

// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
// 모집 판정 기준일(README '기준일') — 리플레이 중이면 replay.defaultAsOf, 아니면 오늘. 마감 = closesOn ≤ 기준일 또는 기준일이 모집 종료일 뒤
const isClosed = (closing, round) => {
  if (!round) return false
  const asOf = round.replay?.defaultAsOf ?? todayKst()
  if (closing?.closesOn && closing.closesOn <= asOf) return true
  return Boolean(round.recruitEnd && asOf > round.recruitEnd)
}
const shorten = (text, max) => {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean
}
// 수기 팀 비교(README '같은 팀'): 띄어쓰기·숫자·괄호·끝의 팀/부/실/본부를 떼고 한쪽이 다른 쪽을 품으면 같은 팀
const teamKey = (text) => (text ?? '').replace(/\([^)]*\)/g, '').replace(/[\s\d()]/g, '').replace(/(팀|부|실|본부)$/, '')
const sameTeam = (a, b) => { const x = teamKey(a); const y = teamKey(b); return Boolean(x && y && (x.includes(y) || y.includes(x))) }

// AI·카카오 호출은 화면이 자리 잡은 뒤에 보낸다 — 개발 모드(StrictMode)의 '마운트 → 해제 → 마운트'에서 첫 요청이 서버까지 가 한도를 쓰지 않게
const deferred = (call, signal) => new Promise((resolve, reject) => {
  const timer = window.setTimeout(() => call().then(resolve, reject), 60)
  signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')) })
})

const loadRound = (signal) => getCurrentRound(signal)
const loadProfile = (signal) => getMyProfile(signal)
const loadExplore = (signal) => getMyExplore(signal)

function DetailDecisionPreview({ type, reasons = [], alerts = [], codes, children }) {
  const anchorRef = useRef(null)
  const popoverRef = useRef(null)
  const timerRef = useRef(null)
  const [preview, setPreview] = useState(null)
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
    }, 180)
  }
  const hide = () => { window.clearTimeout(timerRef.current); setPreview(null) }
  useEffect(() => () => window.clearTimeout(timerRef.current), [])
  return <span ref={anchorRef} className="job-detail-preview-anchor" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} tabIndex="0">{children}{preview && createPortal(<aside ref={popoverRef} className={`job-detail-preview is-${preview.placement}`} style={{ left: preview.left, top: preview.top }} role="tooltip">
    <h3>{type === 'document' ? '문서 검토 내용' : '판정 근거'}</h3>
    {type === 'document'
      ? <div>{alerts.map((alert, index) => <article key={alert.id ?? index}><b>{label(codes, 'alertKind', alert.kind)}</b><p>{alert.description}</p>{alert.quoteA && <blockquote>“{alert.quoteA}”</blockquote>}{alert.quoteB && <blockquote>“{alert.quoteB}”</blockquote>}<small>{[alert.documentTitle, alert.pageA && `${alert.pageA}쪽`, alert.pageB && `${alert.pageB}쪽`].filter(Boolean).join(' · ')}</small></article>)}</div>
      : <div>{reasons.map((reason, index) => <article key={`${reason.layer}-${reason.item}-${index}`}><b>{reason.item}</b><dl><div><dt>필요 조건</dt><dd>{reason.requirement}</dd></div><div><dt>내 조건</dt><dd>{reason.mine}</dd></div></dl><small>{label(codes, 'reasonResult', reason.result)}</small></article>)}</div>}
  </aside>, document.body)}</span>
}

function DetailInstitutionLogo({ institution }) {
  const [failed, setFailed] = useState(null)
  const source = resolveApiAssetUrl(institution.logoPath)
  return <div className="job-detail-institution-logo">{source && source !== failed ? <img src={source} alt={`${institution.name} 로고`} onError={() => setFailed(source)} /> : <><b aria-hidden="true">{institution.name?.[0] ?? '기'}</b><small>{institution.name}</small></>}</div>
}

function DetailLoading({ complete }) {
  return <main className="job-detail-loading-page"><section className={`job-detail-loading ${complete ? 'is-complete' : ''}`} role="status"><div className="job-detail-loading-mark" aria-hidden="true">{complete ? '✓' : <i />}</div><strong>{complete ? '불러왔어요' : 'LOADING'}</strong><p>{complete ? '정리한 정보와 원문 근거를 보여 드릴게요.' : '직무 정보를 읽고 있어요.'}</p><small>{complete ? '' : '서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요.'}</small></section></main>
}

function AiCitationsSkeleton() {
  return <div className="job-detail-ai-citations job-detail-ai-skeleton-citations" aria-hidden="true"><h3>근거 · 내 글 → 공고</h3><div>{[0, 1].map((index) => <article key={index}><i /><span /><span /><small /></article>)}</div></div>
}

// '왜 나에게 맞나요'(#32) — 탐색 결과가 있어야 만든다. 처음이면 5~7초
function WhyBlock({ why, detail, codes }) {
  if (why.loading) return <>
    <div className="job-detail-ai-summary is-loading" role="status"><b>AI</b><i className="job-detail-ai-text-spinner" aria-hidden="true" /><p>내 탐색 글과 이 공고를 함께 읽고 있어요. 처음 만들 때는 5~7초 걸려요.</p></div>
    <AiCitationsSkeleton />
  </>
  const error = why.error
  if (error?.code === 'EXPLORE_NOT_FOUND') return <div className="jd-ai-empty"><span className="v2-ai">AI</span><div><b>직무 탐색을 하면 이 자리가 내 경험과 어떻게 이어지는지 설명해 드려요</b><p>해 본 일 · 하고 싶은 일을 적으면 AI가 내 글과 이 공고에서 이어지는 구절을 찾아 짝지어 보여 줘요. 아래 조건 · 기준(규칙)은 탐색 없이도 볼 수 있어요.</p></div><Link className="v2-btn sm" to="/explore">직무 탐색 하러 가기 →</Link></div>
  if (error?.code === 'EXPLORE_NOT_CANDIDATE') return <div className="jd-ai-empty is-muted"><span className="v2-ai">AI</span><div><b>지원할 수 없거나 마감된 자리라 설명을 만들지 않아요</b><p>AI 설명은 지원할 수 있고 모집 중인 자리에만 만들어요. 무엇 때문인지는 아래 조건 · 기준과 모집 상태에서 볼 수 있어요.</p></div></div>
  if (error) return <div className="jd-ai-empty is-error" role="alert"><span className="v2-ai">AI</span><div><b>설명을 불러오지 못했어요</b><p>{error.code === 'NETWORK' ? '서버에 연결하지 못했어요.' : '잠시 뒤 다시 시도해 주세요.'} 아래 조건 · 기준은 그대로 볼 수 있어요.</p></div><button type="button" className="v2-btn sm gray" onClick={why.reload}>다시 불러오기</button></div>
  if (why.idle) return <div className="jd-ai-empty"><span className="v2-ai">AI</span><div><b>{why.fit ? '이 자리는 탐색 결과에 있어요 · 설명은 눌러서 만들어요' : '탐색 결과 밖 자리예요 · 내 글과 얼마나 이어지는지 설명을 만들 수 있어요'}</b><p>누르면 AI가 내 탐색 글과 이 공고를 함께 읽고 이어지는 구절을 짝지어 설명해요(처음 5~7초). 처음 만들 때만 AI 한도(계정당 1시간 10회)를 한 번 쓰고, 만든 설명은 저장돼 다시 누르면 바로 보여요.</p></div><button type="button" className="v2-btn sm" onClick={why.start}>AI 설명 만들기</button></div>
  if (!why.data) return null
  const { why: body, fallbackReason } = why.data
  if (!body) return <div className="jd-ai-empty is-muted"><span className="v2-ai">AI</span><div><b>지금은 설명을 만들지 못했어요{fallbackReason ? `(${label(codes, 'exploreFallback', fallbackReason)})` : ''}</b><p>AI 한도나 응답 문제일 수 있어요. 잠시 뒤 다시 열면 그때 만들어요. 아래 조건 · 기준(규칙)은 그대로 볼 수 있어요.</p></div><button type="button" className="v2-btn sm gray" onClick={why.reload}>다시 만들기</button></div>

  const senior = detail.seniorNotes.find((note) => sameTeam(note.teamText, detail.team) && (note.outcomes?.length || note.activities?.length))
  const seniorQuote = senior?.outcomes?.[0] ?? senior?.activities?.[0]
  const cards = [...body.points.map((point, index) => ({ key: `p${index}`, span: `근거 ${index + 1}`, quote: point.studentQuote })),
    ...(seniorQuote ? [{ key: 'senior', span: '같은 팀 선배가 한 일', quote: seniorQuote, note: `선배 수기 · ${senior.documentTitle} · ${senior.page}쪽` }] : [])]
  const text = [body.summary, ...body.points.map((point) => point.text)].join(' ')
  return <>
    <div className="job-detail-ai-summary"><b>AI</b><p>{text}</p></div>
    <div className="job-detail-ai-citations"><h3>근거 · 내 글</h3><div style={{ gridTemplateColumns: `repeat(${Math.min(cards.length, 3)},minmax(0,1fr))` }}>{cards.map((card) => <article key={card.key}><span>{card.span}</span><blockquote>“{card.quote}”</blockquote>{card.note && <p>{card.note}</p>}</article>)}</div></div>
    {(body.tryNew?.length > 0 || body.prepare) && <div className="job-detail-ai-citations jd-ai-next"><h3>이 실습에서</h3><div style={{ gridTemplateColumns: `repeat(${Math.min((body.tryNew?.length ?? 0) + (body.prepare ? 1 : 0), 3)},minmax(0,1fr))` }}>
      {body.tryNew?.map((entry, index) => <article key={`t${index}`}><span>새로 해 볼 일</span><blockquote>{entry.text}</blockquote></article>)}
      {body.prepare && <article><span>미리 채우면 좋은 것</span><blockquote>{body.prepare.text}</blockquote></article>}
    </div></div>}
  </>
}

function AiDecision({ detail, why, codes, isStudent }) {
  const mine = detail.myEligibility
  if (!isStudent) return null
  if (!mine) return <section className="job-detail-ai-decision"><div className="job-detail-ai-heading"><div><span>AI DECISION</span><h2>왜 나에게 맞나요</h2></div></div><div className="jd-ai-empty"><span className="v2-ai">AI</span><div><b>프로필을 저장하면 조건 · 기준과 '왜 나에게 맞나요'를 볼 수 있어요</b><p>학과 · 학년 · 이수 학기 · 평점을 저장하면 이 직무의 지원 판정을 규칙으로 바로 보여 드려요.</p></div><Link className="v2-btn sm" to="/me" state={{ editProfile: true }}>프로필 저장하기 →</Link></div></section>
  const fit = why.data?.fit ?? why.fit
  return <section className={`job-detail-ai-decision ${why.loading ? 'is-loading' : ''}`}>
    <div className="job-detail-ai-heading"><div><span>AI DECISION</span><h2>왜 나에게 맞나요</h2></div><span className="jd-ai-badges">
      {fit && fit !== 'NONE' && <Badge tone="blue">{label(codes, 'exploreFit', fit)}</Badge>}
      {fit === 'NONE' && <Badge>탐색 결과 밖 자리</Badge>}
      <DetailDecisionPreview type="verdict" reasons={mine.reasons} codes={codes}><VerdictBadge verdict={mine.verdict} /></DetailDecisionPreview>
    </span></div>
    <WhyBlock why={why} detail={detail} codes={codes} />
    <div className="job-detail-ai-reasons"><h3 className="job-detail-ai-criteria-title">조건 · 기준 <small className="jd-rule-tag">규칙 판정 · 저장한 프로필 기준</small></h3>
      {mine.reasons.map((reason, index) => <article style={{ '--reason-index': index }} key={`${reason.layer}-${reason.item}-${index}`}>
        <div>{label(codes, 'reasonLayer', reason.layer) !== reason.item && <small>{label(codes, 'reasonLayer', reason.layer)}</small>}<h3>{reason.item}</h3></div>
        <dl><div><dt>필요 조건</dt><dd>{reason.requirement}</dd></div><div><dt>내 조건</dt><dd>{reason.mine}</dd></div></dl>
        {reason.layer === 'MAJOR' ? <b className="is-info">{MAJOR_LABEL[mine.majorMatch] ?? label(codes, 'majorMatch', mine.majorMatch)}</b>
          : <b className={`is-${reason.result.toLowerCase()}`}>{label(codes, 'reasonResult', reason.result)}</b>}
      </article>)}
    </div>
  </section>
}

// 이 실습으로 이어지는 길(#33) — NCS 세분류 · 능력단위 · 넓혀 갈 직무 3개 · 이어지는 직업
function CareerPath({ career, why, explore, detail, codes }) {
  const [allUnits, setAllUnits] = useState(false)
  const head = <div className="v2-career-head"><div><span>CAREER PATH</span><h2>이 실습으로 이어지는 길</h2></div>{!explore && <Link className="v2-link" to="/explore">직무 탐색 →</Link>}</div>
  if (career.loading) return <section className="v2-career">{head}<div className="jd-career-state" role="status"><span className="v2-spinner" aria-hidden="true" />이어지는 길을 불러오는 중이에요…</div></section>
  if (career.error) return <section className="v2-career">{head}<div className="jd-career-state is-error" role="alert">이어지는 길을 불러오지 못했어요. <button type="button" className="v2-btn sm gray" onClick={career.reload}>다시 불러오기</button></div></section>
  const data = career.data
  if (!data) return null
  if (!data.ncs) return <section className="v2-career">{head}<p className="v2-muted">이 직무는 아직 NCS 세분류가 정해지지 않았어요.</p></section>
  const { ncs } = data
  const units = allUnits ? ncs.units : ncs.units.slice(0, UNIT_PREVIEW)
  const item = explore?.items?.find((entry) => String(entry.jobId) === String(detail.id))
  const linked = why.data?.why?.points?.length ? why.data.why.points.map((point) => ({ job: point.jobQuote, student: point.studentQuote }))
    : item?.links?.length ? item.links.filter((link) => link.jobQuote).map((link) => ({ job: link.jobQuote, student: `${label(codes, 'exploreBasis', link.basis)} · ${link.studentQuote}` })) : []
  const occupationText = (list) => list.map((job) => job.name).join(' · ')
  const nowJobs = new Set(data.occupations.map((job) => job.code))
  const jobType = detail.conditions.jobType
  return <section className="v2-career">
    {head}
    <div className="v2-flow">
      <div className="v2-flow-col"><span>① 내 경험</span>
        {linked.length > 0 ? <ul>{linked.slice(0, 3).map((entry, index) => <li key={index}>{shorten(entry.student, 46)}</li>)}</ul>
          : <p className="v2-muted">{explore ? '이 자리는 탐색 결과에 들지 않아 이어진 구절이 없어요. 위 설명에서 이어지는 정도를 볼 수 있어요.' : '직무 탐색을 하면 내 경험 글과 이어진 이 자리의 일이 여기에 보여요.'}</p>}
      </div>
      <span className="v2-arrow" aria-hidden="true">→</span>
      <div className="v2-flow-col is-here"><span>② 실습 중</span>
        <ul>{units.map((unit) => <li key={unit.code} title={unit.definition ?? undefined}>{unit.name}</li>)}</ul>
        {ncs.units.length > UNIT_PREVIEW && <button type="button" className="jd-more" onClick={() => setAllUnits((value) => !value)}>{allUnits ? '접기 ↑' : `능력단위 ${ncs.units.length - UNIT_PREVIEW}개 더 보기 ↓`}</button>}
      </div>
      <span className="v2-arrow" aria-hidden="true">→</span>
      <div className="v2-flow-col"><span>③ 실습 뒤</span><h4>넓혀 갈 직무 · 일자리</h4>
        <div className="fx-stack jd-next-stack">
          {data.expand.map((entry) => <div className="v2-next" key={entry.code}><b>{entry.name} <em className={`jd-rel is-${entry.relation.toLowerCase()}`}>{label(codes, 'ncsRelation', entry.relation)}</em></b>{(() => { const extra = entry.occupations.filter((job) => !nowJobs.has(job.code)); return extra.length > 0 && <small>더 갈 수 있는 일자리: {occupationText(extra.slice(0, 3))}</small> })()}</div>)}
          {jobType === 'HIRING' && <p className="v2-muted jd-occ">이 자리는 채용연계형이에요. 채용 조건은 운영계획서 원문으로 확인해 주세요.</p>}
        </div>
      </div>
    </div>
    <p className="v2-foot">출처 · {NCS_SOURCE} · 넓혀 갈 직무는 팀이 고른 것</p>
  </section>
}

// 통근 칸 — 출발지는 저장한 프로필의 사는 곳(없으면 서경대). 결과는 이 화면 상태로만 들고 저장하지 않는다(AGENTS.md)
function CommuteCard({ jobId, hasCoordinates, workplace, profile, codes, ready }) {
  const homeAreaCode = profile?.homeAreaCode ?? null
  const loadCommute = useCallback((signal) => deferred(() => getCommute(jobId, homeAreaCode, signal), signal), [jobId, homeAreaCode])
  const commute = useRequest(loadCommute, hasCoordinates && ready)
  const originGuess = profile?.homeArea?.name ?? '서경대'
  const source = <>에서 출발 · {label(codes, 'commuteProvider', 'KAKAO_MAP') || '카카오맵'} 대중교통 기준</>
  let body
  if (!hasCoordinates) body = <p>근무지 주소가 없어 통근 시간을 계산할 수 없어요.</p>
  else if (!ready || commute.loading) body = <><p><b>{originGuess}</b>{source}</p><div className="jd-commute-wait" role="status"><span className="v2-spinner" aria-hidden="true" />통근 시간을 불러오는 중…</div></>
  else if (commute.error) body = <><p><b>{originGuess}</b>{source}</p><div className="jd-commute-wait is-error" role="alert">통근 시간을 불러오지 못했어요. <button type="button" className="link-button" onClick={commute.reload}>다시 불러오기</button></div></>
  else if (!commute.data?.available) body = <><p><b>{commute.data?.origin?.label ?? originGuess}</b>{source}</p><div className="jd-commute-wait is-error">불러오지 못했어요({label(codes, 'commuteUnavailable', commute.data?.unavailableReason)}). <button type="button" className="link-button" onClick={commute.reload}>다시 불러오기</button></div></>
  else body = <><p><b>{commute.data.origin.label}</b>{source}{commute.data.origin.type === 'SCHOOL' && <small className="jd-commute-note">사는 곳을 저장하지 않아 서경대에서 출발로 계산했어요</small>}</p><div><strong>약 {commute.data.minutes}분</strong><span>환승 {commute.data.transfers}회{commute.data.fareWon != null && ` · 요금 ${won(commute.data.fareWon)}`}</span></div></>
  return <section className="commute"><h2>통근</h2><p className="commute-workplace"><b>근무지</b> · {workplace || '주소 미기재'}</p><div className="commute-body">{body}</div></section>
}

function EvidenceSection({ detail, codes }) {
  const { evidence, alerts } = detail
  return <section className="job-detail-section job-detail-evidence-section" id="job-evidence"><span className="job-detail-section-number">04</span><div className="job-detail-section-body"><p className="job-detail-kicker">POSTING INFORMATION</p><h2>공고 정보</h2>
    {alerts.length > 0 && <div className="job-detail-alerts jd-alerts-top"><h3>검토 알림 {alerts.length}건</h3>{alerts.map((alert, index) => <article key={alert.id ?? index}><div><Badge tone="orange">{label(codes, 'alertKind', alert.kind)}</Badge><p>{alert.description}</p></div></article>)}</div>}
    {evidence.length === 0 ? <p>AI가 운영계획서에서 뽑은 항목이 없어요.</p>
      : <div className="job-detail-evidence-list jd-evidence">{evidence.map((entry, index) => <article style={{ '--evidence-index': Math.min(index, 12) }} key={`${entry.fieldKey}-${index}`}><h3>{entry.label}</h3><div><strong>{entry.rawValue || '미기재'}</strong></div></article>)}</div>}
    <p className="job-detail-caution">AI가 운영계획서에서 뽑은 값이라 원문과 다를 수 있어요. 최종 지원 전 센터 공지로 확인하세요.</p>
  </div></section>
}

function SeniorNote({ note, team }) {
  const [open, setOpen] = useState(false)
  const same = sameTeam(note.teamText, team)
  return <article className="jd-senior-note">
    <button type="button" className="jd-senior-toggle" aria-expanded={open} onClick={() => setOpen(true)}>
      <span className="jd-senior-head"><b>{note.termCode} · {note.teamText}</b>{same && <Badge tone="blue">같은 팀</Badge>}</span>
      <span className="jd-senior-preview-label">참여 소감</span>
      <span className="jd-senior-preview">{note.reflection || note.oneLine || '등록된 참여 소감이 없어요.'}</span>
      <span className="jd-senior-toggle-hint">상세 보기</span>
    </button>
    {open && <SeniorNoteSheet note={note} same={same} close={() => setOpen(false)} />}
  </article>
}

export function SeniorNoteSheet({ note, same, close, institution, noteStatus, onRetry }) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeRef = useRef(close)
  const closeTimer = useRef(null)
  useEffect(() => { closeRef.current = close }, [close])
  const requestClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    closeTimer.current = window.setTimeout(() => closeRef.current(), reducedMotion ? 0 : 360)
  }, [])
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') requestClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previousOverflow; window.clearTimeout(closeTimer.current); window.removeEventListener('keydown', closeOnEscape) }
  }, [requestClose])
  const contentRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const [bar, setBar] = useState({ top: 0, height: 0, visible: false })
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
  }, [updateBar, note.reflection, noteStatus])
  const startDrag = (event) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { startY: event.clientY, startScroll: contentRef.current?.scrollTop ?? 0 }
  }
  const moveDrag = (event) => {
    const content = contentRef.current
    const track = trackRef.current
    if (!content || !track || !dragRef.current) return
    const travel = track.clientHeight - bar.height
    if (travel > 0) content.scrollTop = dragRef.current.startScroll + (event.clientY - dragRef.current.startY) * ((content.scrollHeight - content.clientHeight) / travel)
  }
  const titleId = `senior-note-${note.termCode}-${note.page}`
  return createPortal(<div className={`jd-senior-sheet-overlay ${closing ? 'is-closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
    <section className="jd-senior-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <span className="jd-senior-sheet-grip" aria-hidden="true" />
      <button type="button" className="jd-senior-sheet-close" aria-label="닫기" onClick={requestClose}>×</button>
      <div className="jd-senior-sheet-shell">
        <div ref={contentRef} className="jd-senior-sheet-content" onScroll={updateBar}>
          <header className="jd-senior-sheet-heading">{institution && <InstitutionLogo key={institution.logoPath} institution={institution} className="jd-senior-sheet-logo" />}<span className="jd-senior-sheet-kicker">SENIOR STORY · 우수 참여수기</span><h2 id={titleId}>{note.title || `${note.termCode} · ${note.teamText}`}</h2>{same && <Badge tone="blue">같은 팀</Badge>}{note.meta && <p>{note.meta}</p>}</header>
          {note.reflection && <section className="jd-senior-sheet-reflection"><h3>참여 소감</h3><p>{note.reflection}</p></section>}
          {noteStatus && <section className="jd-senior-sheet-reflection"><h3>참여 소감</h3><p>{noteStatus} {onRetry && <button type="button" className="link-button" onClick={onRetry}>다시 불러오기</button>}</p></section>}
          {note.oneLine && <p className="jd-senior-sheet-line">“{note.oneLine}”</p>}
          <div className="jd-senior-sheet-columns">
            <section><h3>실습 내용</h3>{note.activities?.length ? <ul>{note.activities.map((activity, index) => <li key={index}>{activity}</li>)}</ul> : <p>기록된 실습 내용이 없어요.</p>}</section>
            <section><h3>실습 결과</h3>{note.outcomes?.length ? <ul>{note.outcomes.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul> : <p>{note.results ? shorten(note.results, 90) : '기록된 실습 결과가 없어요.'}</p>}</section>
          </div>
          <div className="jd-senior-sheet-full">
            {note.companyIntro && <section><h3>기관 · 부서 소개</h3><p>{note.companyIntro}</p></section>}
            {note.results && <section><h3>실습 결과</h3><p>{note.results}</p></section>}
          </div>
          {note.documentTitle && <footer>출처 · {note.documentTitle}{note.page != null && ` · ${note.page}쪽`}</footer>}
        </div>
        <div ref={trackRef} className={`jd-senior-sheet-scrollbar ${bar.visible ? 'is-visible' : ''}`} aria-hidden="true"><span style={{ height: bar.height, transform: `translateY(${bar.top}px)` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} /></div>
      </div>
      {institution?.id != null && <div className="jd-senior-sheet-action"><Link to="/jobs" state={{ institutionId: institution.id, institutionName: institution.name }}>직무 보기 <span aria-hidden="true">→</span></Link></div>}
    </section>
  </div>, document.body)
}

function InstitutionSection({ detail, codes }) {
  const { institution, photos, seniorNotes } = detail
  const rows = [
    ['기관명', institution.name],
    ['규모', [label(codes, 'size', institution.size), label(codes, 'listing', institution.listing)].filter(Boolean).join(' · ')],
    ['업태 · 종목', [institution.businessType, institution.businessItem].filter(Boolean).join(' · ') || '미기재'],
    ['주소', institution.address ?? '미기재'],
    ['사업자 상태', institution.ntsStatus ? `${label(codes, 'ntsStatus', institution.ntsStatus)}${institution.ntsCheckedOn ? ` (${institution.ntsCheckedOn} 확인)` : ''}` : '미확인'],
  ]
  const photoSource = photos[0] ? `${photos[0].documentTitle}${photos[0].page != null ? ` · ${photos[0].page}쪽` : ''}` : ''
  return <section className="job-detail-section" id="job-institution"><span className="job-detail-section-number">05</span><div className="job-detail-section-body"><p className="job-detail-kicker">INSTITUTION</p><h2>기관 정보</h2>
    <dl className="job-detail-rows">{rows.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>
    {photos.length > 0 && <div className="jd-photos"><h3>회사 전경 및 활동사진</h3><div className="jd-photo-grid" style={{ gridTemplateColumns: `repeat(${photos.length === 4 ? 4 : Math.min(photos.length, 3)},minmax(0,1fr))` }}>{photos.map((photo) => <figure key={photo.seq}><img src={resolveApiAssetUrl(photo.path)} width={photo.width} height={photo.height} style={{ aspectRatio: `${photo.width} / ${photo.height}` }} alt={photo.caption ?? `${institution.name} 소개서 사진 ${photo.seq}`} loading="lazy" />{photo.caption && <figcaption>{photo.caption}</figcaption>}</figure>)}</div><small className="jd-photo-source">출처 · {photoSource} · 소개서에 실린 사진 그대로예요</small></div>}
    {seniorNotes.length > 0 && <div className="job-detail-senior"><h3>선배 수기 <small className="jd-rule-tag">우수 참여수기 기준</small></h3><p className="jd-senior-caution">학교가 고른 우수 수기라 좋은 점 위주예요. 기관을 평가하는 데 쓰지 않아요. 이름 · 학과 · 사진은 싣지 않아요.</p>{seniorNotes.map((note, index) => <SeniorNote key={`${note.termCode}-${note.page}-${index}`} note={note} team={detail.team} />)}</div>}
  </div></section>
}

export function JobDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const codes = useCodes()
  const session = useSession()
  const isStudent = session.isStudent
  const goBack = () => {
    if (location.key === 'default') { navigate('/jobs', { replace: true }); return }
    requestScrollRestore(location.state?.returnScrollY)
    navigate(-1)
  }
  const loadJob = useCallback((signal) => getJob(id, signal), [id])
  const job = useRequest(loadJob)
  const loadCareer = useCallback((signal) => getJobCareer(id, signal), [id])
  const career = useRequest(loadCareer, Boolean(job.data))
  const round = useRequest(loadRound)
  const profile = useRequest(loadProfile, isStudent)
  const explore = useRequest(loadExplore, isStudent)
  const hasEligibility = Boolean(job.data?.myEligibility)
  // 추천 직무의 저장된 설명은 그대로 쓰고, 없는 경우 상세 진입 시 만든다. 추천 밖 직무는 버튼을 눌렀을 때만 만든다.
  // 처음 만들 때 AI 한도(계정당 1시간 10회)를 쓰며, 한 번 만든 설명은 서버에 저장된다.
  const exploreItem = explore.data?.items?.find((entry) => String(entry.jobId) === String(id))
  const storedWhy = exploreItem?.why ?? null
  const cachedWhy = explore.data ? getCachedExploreWhy(id, explore.data.createdAt) : null
  const [askedWhyFor, setAskedWhyFor] = useState(null)
  const asked = askedWhyFor === id
  const autoWhy = Boolean(exploreItem && job.data?.myEligibility?.verdict !== 'INELIGIBLE')
  const loadWhy = useCallback((signal) => deferred(() => getExploreWhy(id, signal, explore.data?.createdAt), signal), [id, explore.data?.createdAt])
  const fetchedWhy = useRequest(loadWhy, isStudent && hasEligibility && Boolean(explore.data) && !storedWhy && !cachedWhy && (autoWhy || asked))
  const noop = useCallback(() => {}, [])
  const startWhy = useCallback(() => setAskedWhyFor(id), [id])
  const why = !isStudent || !hasEligibility ? { data: null, loading: false, error: null, reload: noop }
    : explore.loading && !explore.data ? { data: null, loading: true, error: null, reload: noop }
      : explore.error ? { data: null, loading: false, error: explore.error, reload: explore.reload }
        : storedWhy ? { data: { jobId: exploreItem.jobId, fit: exploreItem.fit, why: storedWhy, fallbackReason: null }, loading: false, error: null, reload: noop }
          : cachedWhy ? { data: cachedWhy, loading: false, error: null, reload: noop }
          : job.data.myEligibility.verdict === 'INELIGIBLE' ? { data: null, loading: false, error: { code: 'EXPLORE_NOT_CANDIDATE' }, reload: noop }
            : !asked && !autoWhy ? { data: null, loading: false, error: null, idle: true, start: startWhy, fit: exploreItem?.fit ?? null, reload: noop }
              : fetchedWhy

  const [detailReady, setDetailReady] = useState(false)
  const [activeSection, setActiveSection] = useState('job-requirements')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const navRef = useRef(null)
  const scrollTimer = useRef(null)
  const scrollLock = useRef(false)
  useEffect(() => () => window.clearTimeout(scrollTimer.current), [])
  useEffect(() => {
    if (!job.data) return undefined
    const timer = window.setTimeout(() => setDetailReady(true), 450)
    return () => window.clearTimeout(timer)
  }, [job.data])
  useEffect(() => {
    if (!detailReady) return undefined
    let frame = 0
    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        setShowBackToTop(Boolean(navRef.current && navRef.current.getBoundingClientRect().top <= 66))
        if (scrollLock.current) return
        const sections = SECTIONS.map(([sectionId]) => document.getElementById(sectionId)).filter(Boolean)
        if (!sections.length) return
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) { setActiveSection(sections.at(-1).id); return }
        setActiveSection((sections.filter((section) => section.getBoundingClientRect().top <= 150).at(-1) ?? sections[0]).id)
      })
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [detailReady])

  // 담기(#20) · 빼기(#21). 처음 값은 상세의 planned · planRank
  const [savedOverride, setSavedOverride] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const toastId = useRef(0)
  const saved = savedOverride ?? Boolean(job.data?.planned)
  const rank = savedOverride === null ? job.data?.planRank ?? null : null
  const toggleSave = async () => {
    if (busy) return
    const wasSaved = saved
    setBusy(true)
    try {
      if (wasSaved) await removePlanItem(Number(id))
      else await addPlanItem(Number(id))
      setSavedOverride(!wasSaved)
      setToast({ id: ++toastId.current, type: wasSaved ? 'removed' : 'added', message: wasSaved ? '담기를 취소했어요' : '직무를 담았어요' })
    } catch (caught) {
      setToast({ id: ++toastId.current, type: 'error', message: planErrorMessage(caught, wasSaved ? '빼기' : '담기') })
    } finally {
      setBusy(false)
    }
  }

  if (job.loading || (job.data && !detailReady)) return <DetailLoading complete={Boolean(job.data)} />
  if (job.error) return <main className="job-detail-page"><div className="job-detail-back-anchor"><button className="job-detail-fixed-back" type="button" onClick={goBack}>← 뒤로가기</button></div><div className="job-detail-shell">
    {job.error.code === 'JOB_NOT_FOUND' ? <Empty title="없는 직무예요" action={<Link className="v2-btn" to="/jobs">직무 찾기로 돌아가기 →</Link>}>이번 회차에 없는 직무 번호예요.</Empty>
      : job.error.status === 401 ? <Empty title="로그인하면 직무 상세를 볼 수 있어요" action={<Link className="v2-btn" to="/login">로그인 · 체험 계정 →</Link>}>체험 계정은 24시간 뒤 지워져요.</Empty>
      : <Empty title="직무 정보를 불러오지 못했어요" action={<button type="button" className="v2-btn line" onClick={job.reload}>다시 불러오기</button>}>{job.error.code === 'NETWORK' ? '서버에 연결하지 못했어요. 서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요.' : '잠시 뒤 다시 시도해 주세요.'}</Empty>}
  </div></main>
  const detail = job.data
  if (!detail) return null
  const { institution, conditions, requirements, closing } = detail
  const closed = isClosed(closing, round.data)
  const stipend = conditions.stipend?.amount ? `${label(codes, 'stipendBasis', conditions.stipend.basis)} ${won(conditions.stipend.amount)}` : '미기재'
  const period = conditions.period ? `${conditions.period.start} ~ ${conditions.period.end}` : '미기재'
  const workplace = detail.workplace.address ?? institution.address
  const requirementRows = [
    ['학년', label(codes, 'gradeRule', requirements.gradeRule) || '조건 없음'],
    ['학점', requirements.gpaMin != null ? `평점 ${Number(requirements.gpaMin).toFixed(1)} 이상` : '조건 없음'],
    ['선호 전공', requirements.majorOpen ? '전공 무관' : <>{requirements.majorText}{requirements.majorAliases.length > 0 && <span className="jd-alias">{requirements.majorAliases.map((alias) => <small key={alias.label}>‘{alias.label}’ → {alias.departments.length ? alias.departments.map((department) => department.name).join(', ') : '학과 확정 전'}</small>)}</span>}</>],
    ['포트폴리오', label(codes, 'requirement', requirements.portfolio)],
    ['자격증', `${label(codes, 'requirement', requirements.certificate)}${requirements.certificateText ? ` · ${requirements.certificateText}` : ''}`],
  ]
  const conditionRows = [
    ['실습 기간', period],
    ['실습 시간', `${conditions.workHoursText ?? '미기재'}${conditions.weeklyHours ? ` · 주 ${conditions.weeklyHours}시간` : ''}`],
    ['실습 요일', (conditions.weekdays ?? []).map((day) => label(codes, 'weekday', day)).join(', ') || '미기재'],
    ['실습지원비', conditions.stipend?.amount ? `${stipend}${conditions.stipend.minWageRatio != null ? ` (최저임금 대비 ${conditions.stipend.minWageRatio}%)` : ''}` : '미기재'],
    ['복리후생', (conditions.benefits ?? []).map((benefit) => label(codes, 'benefit', benefit)).join(', ') || '없음'],
    ['모집 인원', `${conditions.headcount}명`],
    ['연장 실습', label(codes, 'overtime', conditions.overtime) || '미기재'],
    ['모집 마감', closed ? `마감${closing.closesOn ? ` (${fmtDate(dayBefore(closing.closesOn))}까지)` : ''}` : closing.closesOn ? `${fmtDate(dayBefore(closing.closesOn))}까지${closing.closeReason ? ` · ${label(codes, 'closeReason', closing.closeReason)}` : ''}${closing.closesOnIsVirtual ? ' · 가상 날짜' : ''}` : '모집 기간 끝까지'],
  ]
  const scrollTo = (event, sectionId) => {
    event.preventDefault()
    window.clearTimeout(scrollTimer.current)
    scrollLock.current = true
    setActiveSection(sectionId)
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    scrollTimer.current = window.setTimeout(() => { scrollLock.current = false }, 850)
  }

  return <main className="job-detail-page"><div className="job-detail-back-anchor"><button className="job-detail-fixed-back" type="button" onClick={goBack}>← 뒤로가기</button></div><div className="job-detail-shell">
    <header className="job-detail-hero"><div className="job-detail-hero-main"><DetailInstitutionLogo institution={institution} /><div className="job-detail-hero-copy">
      <span className="job-detail-eyebrow">{institution.name} · {detail.team}</span><h1>{detail.title}</h1>
      <div className="job-detail-meta">
        <Badge tone="blue">{label(codes, 'jobType', conditions.jobType)}</Badge><Badge>{label(codes, 'course', conditions.course)}</Badge>
        {closed ? <Badge>마감</Badge> : closing.closesOn && <Badge tone="orange">{fmtDate(dayBefore(closing.closesOn))} 마감{closing.closesOnIsVirtual ? '(가상)' : ''}</Badge>}
        {detail.alerts.length > 0 && <DetailDecisionPreview type="document" alerts={detail.alerts} codes={codes}><Badge tone="orange">문서 검토 {detail.alerts.length}건</Badge></DetailDecisionPreview>}
      </div>
      <p className="job-detail-views">조회 {detail.views.toLocaleString('ko-KR')} · 오늘 조회 {detail.todayViews.toLocaleString('ko-KR')}</p>
    </div></div>
    {isStudent && <button type="button" className={`job-detail-save ${saved ? 'is-saved' : ''}`} disabled={busy} title={saved ? '다시 누르면 담기를 취소해요(지망 순위도 빠져요 · 이미 낸 지원서의 지망은 그대로예요)' : undefined} onClick={toggleSave}>{busy ? <i className="job-detail-button-spinner" aria-label="처리 중" /> : saved ? `담김${rank ? ` · ${rank}지망` : ''}` : '담기'}</button>}
    </header>
    <section className="job-detail-highlights"><div><span>실습지원비</span><strong>{stipend}</strong></div><div><span>실습 기간</span><strong>{period}</strong></div><div><span>모집 인원</span><strong>{conditions.headcount}명</strong></div><div><span>근무지</span><strong>{workplace ?? '미기재'}</strong></div></section>

    <AiDecision detail={detail} why={why} codes={codes} isStudent={isStudent} />

    <nav ref={navRef} className="job-detail-nav" aria-label="직무 상세 바로가기">{SECTIONS.map(([sectionId, name]) => <a className={activeSection === sectionId ? 'is-active' : ''} aria-current={activeSection === sectionId ? 'location' : undefined} href={`#${sectionId}`} key={sectionId} onClick={(event) => scrollTo(event, sectionId)}>{name}</a>)}</nav>
    <div className="job-detail-content">
      <section className="job-detail-section" id="job-requirements"><span className="job-detail-section-number">01</span><div className="job-detail-section-body"><p className="job-detail-kicker">REQUIREMENTS</p><h2>지원 조건</h2><dl className="job-detail-rows">{requirementRows.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><p className="jd-school-rule">{SCHOOL_RULE_NOTE}</p></div></section>
      <section className="job-detail-section" id="job-overview"><span className="job-detail-section-number">02</span><div className="job-detail-section-body"><p className="job-detail-kicker">ROLE</p><h2>이런 일을 해요</h2><p className="job-detail-lead jd-pre">{detail.overview || '직무 개요가 운영계획서에 없어요.'}</p><div className="job-detail-two-up"><div><h3>교육 목표</h3><p className="jd-pre">{detail.educationGoal || '미기재'}</p></div><div><h3>요구 역량</h3><p className="jd-pre">{detail.competencies || '미기재'}</p></div></div>{detail.weeklyPlan.length > 0 && <div className="job-detail-weekly"><h3>주차별 계획</h3>{detail.weeklyPlan.map((week) => <div key={week.seq}><b>{week.weeksLabel}</b><span>{week.content}</span></div>)}</div>}</div></section>
      <section className="job-detail-section" id="job-conditions"><span className="job-detail-section-number">03</span><div className="job-detail-section-body"><p className="job-detail-kicker">CONDITIONS</p><h2>실습 조건</h2><dl className="job-detail-rows is-grid">{conditionRows.map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><CommuteCard jobId={detail.id} hasCoordinates={detail.workplace.hasCoordinates} workplace={workplace} profile={profile.data} codes={codes} ready={!session.loading && (!isStudent || !profile.loading)} /></div></section>
      <EvidenceSection detail={detail} codes={codes} />
      <InstitutionSection detail={detail} codes={codes} />
    </div>
    <CareerPath career={career} why={why} explore={explore.data} detail={detail} codes={codes} />
    <button className={`job-detail-back-to-top ${showBackToTop ? 'is-visible' : ''}`} type="button" aria-hidden={!showBackToTop} tabIndex={showBackToTop ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span aria-hidden="true">↑</span> 위로가기</button>
    {toast && <Toast key={toast.id} className="first-save-toast" onAnimationEnd={() => setToast((current) => current?.id === toast.id ? null : current)}><span className={`first-save-toast-icon ${toast.type}`} aria-hidden="true">{toast.type === 'removed' ? '−' : toast.type === 'error' ? '!' : '✓'}</span><div><b>{toast.message}</b><small>{toast.type === 'error' ? '잠시 뒤 다시 눌러 주세요.' : '담은 직무와 지망 순위는 내 현장실습 > 지망 정하기에서 봐요.'}</small></div><Link to="/internship?step=pick">담은 직무 보기</Link></Toast>}
  </div></main>
}
