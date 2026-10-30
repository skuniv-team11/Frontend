import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { deleteMyExplore, getMyExplore } from '../../api/explore'
import { getJobCareer } from '../../api/jobs'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { label } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { ReasonSheet } from '../jobs/JobsPage'
import { ErrorBox, InstitutionLogo, Loading, NeedLogin, VerdictBadge } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes, useSession } from '../../hooks/useSession'
import { fmtDate } from '../../lib/format'
import './Explore.css'

const loadExplore = (signal) => getMyExplore(signal)
const loadPlan = (signal) => getMyPlan(signal)

const BASIS_CLS = { EXPERIENCE: 'exp', CARD: 'want', INTEREST: 'interest' }
const ORDER_RULE = '순서는 AI가 아니라 규칙이 정해요: 근거 단계(해 본 일과 같은 일 → 해 본 일이 쓰이는 일 → 고른 하고 싶은 일 → 관심 분야) → 선호 전공 → 이어진 짝 수'

// 구절 대조용(띄어쓰기·따옴표·글머리표 무시 — 서버 대조와 같은 기준)
const norm = (text) => String(text ?? '').replace(/[\s"'“”‘’`·•*\-–—]/g, '')
const contains = (whole, part) => Boolean(part) && norm(whole).includes(norm(part))
const docText = (link) => (link.documentTitle ? `${link.documentTitle}${link.page ? ` ${link.page}쪽` : ''}` : '공고 원문 칸에서 찾지 못했어요')

// 학생 구절이 내 글의 어디에서 왔는지(경험 N · 고른 일 · 관심 분야)
function sourceOf(quote, input) {
  const exps = input?.experiences ?? []
  const index = exps.findIndex((text) => contains(text, quote))
  if (index >= 0) return [`경험 ${index + 1}`, 'exp']
  if ((input?.cards ?? []).some((text) => contains(text, quote))) return ['고른 일', 'want']
  if (contains(input?.interestText, quote)) return ['관심 분야', 'interest']
  return ['내 글', 'exp']
}

// 원문에서 구절을 찾아 강조(못 찾으면 원문 그대로)
function Highlight({ text, quote }) {
  const at = quote ? text.indexOf(quote) : -1
  if (at < 0) return <q>{text}</q>
  return <q>{text.slice(0, at)}<mark>{quote}</mark>{text.slice(at + quote.length)}</q>
}

export function ExploreResultPage() {
  const session = useSession()
  if (!session.loggedIn) return <NeedLogin />
  if (session.me && !session.isStudent) return <NeedLogin />
  return <ResultScreen />
}

function ResultScreen() {
  const navigate = useNavigate()
  const codes = useCodes()
  const explore = useRequest(loadExplore)
  const plan = useRequest(loadPlan)
  const [selectedJob, setSelectedJob] = useState(null)
  const [pathClosing, setPathClosing] = useState(false)
  const pathTimer = useRef(null)
  useEffect(() => () => window.clearTimeout(pathTimer.current), [])
  const closePath = () => {
    if (pathClosing) return
    setPathClosing(true)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 350
    pathTimer.current = window.setTimeout(() => { setSelectedJob(null); setPathClosing(false) }, delay)
  }
  const selectPath = (jobId) => {
    if (selectedJob === jobId) { closePath(); return }
    window.clearTimeout(pathTimer.current)
    setPathClosing(false)
    setSelectedJob(jobId)
  }
  const [reasonJob, setReasonJob] = useState(null)
  const [busyJob, setBusyJob] = useState(null)
  const [planMessage, setPlanMessage] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const data = explore.data
  const items = data?.items ?? []
  const pathJobId = items.some((item) => item.jobId === selectedJob) ? selectedJob : null
  const loadCareer = useCallback((signal) => getJobCareer(pathJobId, signal), [pathJobId])
  const career = useRequest(loadCareer, Boolean(pathJobId))

  const plannedIds = new Set((plan.data?.items ?? []).map((item) => item.jobId))
  const togglePlan = async (item) => {
    if (busyJob) return
    const saved = plannedIds.has(item.jobId)
    setBusyJob(item.jobId); setPlanMessage('')
    try {
      const current = plan.data?.items ?? []
      if (saved) {
        await removePlanItem(item.jobId)
        plan.mutate({ ...(plan.data ?? {}), items: current.filter((x) => x.jobId !== item.jobId) })
      } else {
        await addPlanItem(item.jobId)
        plan.mutate({ ...(plan.data ?? {}), items: [...current, { jobId: item.jobId, title: item.title, institution: item.institution, rank: null }] })
      }
    } catch (error) {
      setPlanMessage(planErrorMessage(error, saved ? '빼기' : '담기'))
    } finally {
      setBusyJob(null)
    }
  }

  const remove = async (dismiss) => {
    setDeleting(true); setDeleteError(null)
    try {
      await deleteMyExplore()
      dismiss()
      navigate('/explore', { replace: true })
    } catch (error) {
      setDeleteError(error)
      setDeleting(false)
    }
  }

  if (explore.loading && !data) return <main className="fx-page"><div className="fx-shell"><Loading text="탐색 결과를 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." /></div></main>
  if (explore.error) {
    return <main className="fx-page"><div className="fx-shell">
      {explore.error.code === 'EXPLORE_NOT_FOUND'
        ? <div className="fx-card v2-state is-empty"><b>아직 탐색한 결과가 없어요</b><p>해 본 일과 하고 싶은 일을 적으면 지원할 수 있는 자리 중에서 이어지는 곳을 찾아 줘요.</p><Link className="fx-btn primary" to="/explore">직무 탐색하러 가기 →</Link></div>
        : <ErrorBox error={explore.error} retry={explore.reload} />}
    </div></main>
  }

  const rule = data.source === 'RULE'
  const fallback = data.fallbackReason ? label(codes, 'exploreFallback', data.fallbackReason) : null
  const candidates = data.candidates ?? { total: 0, eligible: 0, needsCheck: 0 }
  const input = data.input ?? {}
  const pathItem = items.find((item) => item.jobId === pathJobId)

  return <main className="fx-page"><div className="fx-shell">
    <div className="rs-head">
      <header className="page-title"><span>EXPLORE RESULT · {fmtDate(data.createdAt)} 탐색</span>
        <h1>{items.length ? '나에게 맞는 현장실습' : '이어진 근거가 있는 자리가 없어요'}</h1>
        {(data.fallbackReason === 'NO_CANDIDATES' || rule) && <p>{data.fallbackReason === 'NO_CANDIDATES' ? '지금 프로필로는 지원할 수 있는 마감 전 자리가 없어 AI를 부르지 않았어요.' : `AI 대신 규칙 추천으로 골랐어요 — ${fallback ?? '규칙 추천'}.`}</p>}
      </header>
      <div className="fx-row rs-top-actions"><button type="button" className="v2-btn sm gray" onClick={() => setAskDelete(true)}>결과 지우기</button><Link className="v2-btn sm gray" to="/explore">다시 탐색하기</Link><Link className="v2-btn sm" to="/jobs">직무 찾기에서 보기 →</Link></div>
    </div>

    <div className="rs-notes">
      {rule && items.length > 0 && <div className="fx-callout warn"><span className="fx-callout-icon">!</span><div><b>{fallback ?? 'AI를 쓰지 못해'} — 규칙 추천으로 대신했어요.</b> AI가 이은 근거가 없어서 자리마다 '{label(codes, 'exploreFit', 'NONE')}'으로 보이고 짝 목록이 없어요. 운영계획서 근거 인용만 함께 보여 줘요.{data.fallbackReason === 'LIMITED' && ' 탐색 한도(계정당 1시간 10회)를 넘었어요. 잠시 뒤 다시 탐색해 보세요.'}</div></div>}
      {data.judgedWith === 'SAVED_PROFILE' && data.hiddenCount > 0 && <div className="fx-callout"><span className="fx-callout-icon">i</span><div><b>저장한 프로필로 다시 판정해 지금은 후보가 아닌 {data.hiddenCount}곳을 숨겼어요.</b> 순위는 남은 자리끼리 다시 매겼어요. 프로필을 바꿨다면 다시 탐색해 보세요.</div></div>}
    </div>

    {items.length === 0
      ? <EmptyResult data={data} rule={rule} />
      : <>
        {planMessage && <p className="rs-msg" role="alert" style={{ marginBottom: 10 }}>{planMessage}</p>}
        <section className="rs-seats">
          {items.map((item) => <div className={`rs-seat-group ${item.jobId === pathJobId ? 'is-open' : ''}`} key={item.jobId}>
            <SeatCard item={item} codes={codes} input={input} rule={rule}
              selected={item.jobId === pathJobId} onSelect={() => selectPath(item.jobId)}
              onReason={() => setReasonJob(item.jobId)}
              saved={plannedIds.has(item.jobId)} planReady={Boolean(plan.data)} busy={busyJob === item.jobId} onToggle={() => togglePlan(item)} />
            {pathItem?.jobId === item.jobId && <div className={`rs-path-reveal ${pathClosing ? 'is-closing' : ''}`}><div><CareerPath item={pathItem} career={career} codes={codes} onClose={closePath} /></div></div>}
          </div>)}
        </section>
      </>}

    <InputSummary input={input} items={items} title={items.length ? '내 글이 이어진 곳' : '탐색에 쓴 내 글'} />

    <section className="rs-result-guide"><div className="rs-guide-head"><div><span>HOW IT WORKS</span><h2>이렇게 골랐어요</h2></div><span className="rs-guide-count">추천 {items.length}곳</span></div>
      <div className="rs-guide-steps"><div><small>01 · 지원 조건</small><b>{candidates.total}곳 확인</b><p>지원 가능 {candidates.eligible} · 확인 필요 {candidates.needsCheck}</p></div><div><small>02 · 내 글과 연결</small><b>{rule ? '규칙 추천' : '공고와 구절 대조'}</b><p>{rule ? (fallback ?? '지원 조건을 바탕으로 추천했어요') : '내 글과 공고의 연결을 확인했어요'}</p></div><div><small>03 · 결과</small><b>{items.length}곳 추천</b><p>{data.hiddenCount > 0 ? `현재 조건에 맞지 않는 ${data.hiddenCount}곳 제외` : '최대 5곳까지 보여줘요'}</p></div></div>
      <div className="rs-guide-details"><p>{ORDER_RULE}</p><p>지원 불가 · 마감 자리는 AI에 보내지 않아요. 학과 · 학년 · 평점은 AI에 보내지 않으며, 인용 구절은 원문과 대조해요.</p><p>마지막 탐색 결과 1건을 저장하고, 지원 판정은 현재 프로필로 다시 확인해요.</p></div>
    </section>
    <div className="fx-row rs-bottom-actions"><button type="button" className="v2-btn sm gray" onClick={() => setAskDelete(true)}>결과 지우기</button><Link className="v2-btn sm gray" to="/explore">다시 탐색하기</Link><Link className="v2-btn sm" to="/jobs">직무 찾기에서 보기 →</Link></div>

    {items.find((item) => item.jobId === reasonJob) && <ReasonSheet item={items.find((item) => item.jobId === reasonJob)} codes={codes} explore={data} close={() => setReasonJob(null)} />}

    {askDelete && <Modal close={() => setAskDelete(false)} className="rs-modal">{(dismiss) => <>
      <h2>탐색 결과를 지울까요?</h2>
      <p>저장한 결과 · 경험 글 · '왜 맞나요'를 모두 지워요. 지우면 되돌릴 수 없어요. 담아 둔 직무는 그대로예요.</p>
      {deleteError && <p className="danger" role="alert">{errorMessage(deleteError)}</p>}
      <div className="fx-row"><button type="button" className="fx-btn" onClick={dismiss} disabled={deleting}>그대로 두기</button><button type="button" className="fx-btn dark" onClick={() => remove(dismiss)} disabled={deleting}>{deleting ? '지우는 중…' : '결과 지우기'}</button></div>
    </>}</Modal>}
  </div></main>
}

function EmptyResult({ data, rule }) {
  const blocked = data.blockedBy ?? []
  return <div className="fx-card v2-state is-empty">
    <b>이어진 근거가 있는 자리가 없어요</b>
    <p>{data.fallbackReason === 'NO_CANDIDATES'
      ? '지금 프로필로는 지원할 수 있는 마감 전 자리가 없어서 AI를 부르지 않았어요. 자리를 막은 항목별 수예요(항목마다 셈, 겹침 포함).'
      : blocked.length
      ? '지원할 수 있는 자리가 없거나, 있어도 내 글 · 관심 분야와 이어지는 까닭이 없어서예요. 빠진 자리 수(항목마다 셈, 겹침 포함)예요.'
      : rule ? '규칙 추천으로도 이어지는 자리를 찾지 못했어요.' : 'AI가 내 글과 같은 일 · 쓰이는 일을 찾지 못했어요(억지로 채우지 않아요). 해 본 일을 더 구체적으로 적거나 하고 싶은 일을 더 골라 보세요.'}</p>
    {blocked.length > 0 && <ul className="rs-blocked">{blocked.map((row) => <li key={row.item}>{row.item} <b>{row.count}곳</b></li>)}</ul>}
    <div className="fx-row" style={{ marginTop: 6 }}><Link className="fx-btn" to="/me" state={{ editProfile: true }}>프로필 확인</Link><Link className="fx-btn primary" to="/explore">다시 탐색하기</Link></div>
  </div>
}

function SeatCard({ item, codes, input, rule, selected, onSelect, onReason, saved, planReady, busy, onToggle, detailed = false }) {
  const evidence = item.evidence ?? {}
  const links = item.links ?? []
  const why = item.why
  const tags = <div className="rs-tags"><VerdictBadge verdict={item.verdict} /><span className={`rs-fit ${item.fit}`}>{label(codes, 'exploreFit', item.fit)}</span>{evidence.basis && <span className={`v2-src ${BASIS_CLS[evidence.basis] ?? ''}`}>근거 · {label(codes, 'exploreBasis', evidence.basis)}</span>}</div>
  return <article className={`rs-seat ${selected ? 'on' : ''}`}>
    <div className="rs-top">
      <span className="rs-logo"><InstitutionLogo institution={item.institution} /></span>
      <div><small>{item.institution?.name}{item.team ? ` · ${item.team}` : ''}</small><h3><Link to={`/jobs/${item.jobId}`}>{item.title}</Link></h3></div>
      <span className="rs-rank">{item.rank}위</span>
    </div>
    {detailed && tags}
    {detailed && evidence.reason && <p className="rs-reason">{evidence.reason}</p>}
    {detailed && <div className="rs-body">
      <div className="rs-block">
        {links.length > 0
          ? <>
            <div className="fx-row between"><span className="v2-label">이어진 짝 {links.length}개 · 내 글 → 공고</span><span className="rs-ok">구절 확인 ✓</span></div>
            <ul className="rs-links">{links.map((link, i) => <li key={i} className="rs-link">
              <span className={`v2-src ${BASIS_CLS[link.basis] ?? ''}`}>{label(codes, 'exploreBasis', link.basis)}</span>
              <span className="rs-pair"><q>“{link.studentQuote}”</q>{link.jobQuote ? <q className="job">“{link.jobQuote}”</q> : null}<small>{label(codes, 'exploreFit', link.kind)} · {docText(link)}</small></span>
            </li>)}</ul>
          </>
          : <>
            <span className="v2-label">{rule ? '운영계획서 근거 · 규칙 추천' : '근거'}</span>
            {evidence.jobQuote
              ? <div className="rs-link"><span className="v2-src">공고</span><span className="rs-pair"><q className="job">“{evidence.jobQuote}”</q><small>{docText(evidence)}</small></span></div>
              : <p className="rs-empty-why">인용할 원문이 없어요.</p>}
          </>}
      </div>
      <div className="rs-block">
        <div className="fx-row between"><span className="v2-label">왜 맞나요 · AI</span>{why && <span className="rs-ok">구절 확인 ✓</span>}</div>
        {why
          ? <>
            <p className="rs-sum">{why.summary}</p>
            {(why.points ?? []).map((point, i) => {
              const [src, cls] = sourceOf(point.studentQuote, input)
              return <div key={`p${i}`} className="rs-why"><span className={`v2-src ${cls}`}>{src}</span><span>{point.text}<small className="rs-q">“{point.studentQuote}” → 공고 “{point.jobQuote}”</small></span></div>
            })}
            {(why.tryNew ?? []).map((row, i) => <div key={`t${i}`} className="rs-why"><span className="v2-src want">새로 해 볼 일</span><span>{row.text}<small className="rs-q">공고 “{row.jobQuote}”</small></span></div>)}
            {why.prepare && <div className="rs-why"><span className="v2-src interest">지원 전에</span><span>{why.prepare.text}<small className="rs-q">공고 “{why.prepare.jobQuote}”</small></span></div>}
          </>
          : <p className="rs-empty-why">{rule ? "규칙 추천 자리라 '왜 맞나요'를 미리 만들지 않았어요." : item.rank > 3 ? "4 · 5위는 '왜 맞나요'를 미리 만들지 않아요." : "'왜 맞나요'를 미리 만들지 못했어요."} <Link to={`/jobs/${item.jobId}`}>직무 상세에서 볼 수 있어요 →</Link></p>}
      </div>
    </div>}
    {!detailed && <div className="rs-foot">
      {tags}
      <div className="rs-foot-actions">
        <button type="button" className="rs-pick" onClick={onReason}>추천 이유 보기</button>
        <button type="button" className={`rs-pick ${selected ? 'on' : ''}`} onClick={onSelect}>{selected ? '진로 접기' : '실습 후 진로'}</button>
        <button type="button" className={`v2-btn sm ${saved ? '' : 'line'}`} disabled={busy || !planReady} onClick={onToggle} title={saved ? '다시 누르면 담기를 취소해요' : undefined}>{busy ? '처리 중…' : saved ? '담김 ✓' : '담기'}</button>
      </div>
    </div>}
  </article>
}

function CareerPath({ item, career, codes, onClose }) {
  const [allUnits, setAllUnits] = useState(false)
  const data = career.data
  const ncs = data?.ncs
  const linked = (item.links ?? []).filter((link) => link.jobQuote && link.studentQuote)
  return <section className="rs-path">
    <header><div><h2>실습 뒤 넓혀 갈 직무 · 일자리</h2></div><span className="fx-small">{item.rank}위 자리 기준</span></header>
    {career.loading && !data && <Loading text="실습 뒤 길을 불러오는 중…" />}
    {career.error && <ErrorBox error={career.error} retry={career.reload} />}
    {data && !ncs && <p className="rs-empty-why">이 직무는 아직 이어지는 길을 정리하지 않았어요.</p>}
    {data && ncs && <>
      <div className="v2-flow">
        <div className="v2-flow-col"><span>① 내 경험</span>
          {linked.length ? <ul>{linked.slice(0, 3).map((link, index) => <li key={index}>{label(codes, 'exploreBasis', link.basis)} · {link.studentQuote}</li>)}</ul> : <p className="v2-muted">이 자리에 이어진 경험 구절이 없어요.</p>}
        </div>
        <span className="v2-arrow" aria-hidden="true">→</span>
        <div className="v2-flow-col is-here"><span>② 실습 중</span>
          <ul>{(allUnits ? ncs.units ?? [] : (ncs.units ?? []).slice(0, 4)).map((unit) => <li key={unit.code} title={unit.definition ?? undefined}>{unit.name}</li>)}</ul>
          {(ncs.units?.length ?? 0) > 4 && <button type="button" className="jd-more" onClick={() => setAllUnits((value) => !value)}>{allUnits ? '접기 ↑' : `능력단위 ${ncs.units.length - 4}개 더 보기 ↓`}</button>}
        </div>
        <span className="v2-arrow" aria-hidden="true">→</span>
        <div className="v2-flow-col"><span>③ 실습 뒤</span><h4>넓혀 갈 직무 · 일자리</h4>
          <div className="fx-stack" style={{ gap: 8 }}>{(data.expand ?? []).map((row) => <div key={row.code} className="v2-next">
            <b>{row.name}</b>
            <small>{label(codes, 'ncsRelation', row.relation)}{row.occupations?.length ? ` · 일자리 예: ${row.occupations.slice(0, 3).map((o) => o.name).join(', ')}` : ''}</small>
          </div>)}</div>
          {(data.expand?.length ?? 0) === 0 && <p className="v2-muted" style={{ margin: 0 }}>고른 넓혀 갈 직무가 없어요.</p>}
        </div>
      </div>
      <div className="rs-current-jobs"><div><span>이어지는 일자리</span></div>{data.occupations?.length ? <div className="rs-jobs">{data.occupations.map((job) => <b key={job.code}>{job.name}</b>)}</div> : <p className="rs-current-jobs-empty">연계표에 맞는 일자리가 없어요.</p>}</div>
      <p className="rs-src-note">출처 · NCS 능력단위(한국산업인력공단) · 직업 연계(한국고용정보원 직업능력 코드매핑정보) · 넓혀 갈 직무는 팀이 고른 것</p>
    </>}
    <div className="rs-path-close"><button type="button" className="v2-btn gray" onClick={onClose}>닫기 ↑</button></div>
  </section>
}

// 입력 요약 — 내 글(경험 · 고른 일 · 관심 분야)이 어느 자리의 어느 구절과 이어졌는지
function InputSummary({ input, items, title }) {
  const usesOf = (match) => {
    const seen = new Set()
    const rows = []
    items.forEach((item) => (item.links ?? []).forEach((link) => {
      if (!match(link)) return
      const key = `${item.jobId}|${link.jobQuote}`
      if (seen.has(key)) return
      seen.add(key)
      rows.push({ key, item, link })
    }))
    return rows
  }
  const blocks = [
    ...(input.experiences ?? []).map((text, i) => {
      const rows = usesOf((link) => link.basis === 'EXPERIENCE' && contains(text, link.studentQuote))
      const whyPoint = items.flatMap((item) => item.why?.points ?? []).find((point) => contains(text, point.studentQuote))
      return { key: `e${i}`, title: `경험 ${i + 1} · 원문`, text, quote: rows[0]?.link.studentQuote ?? whyPoint?.studentQuote, rows }
    }),
    ...(input.cards ?? []).map((text, i) => {
      const rows = usesOf((link) => link.basis === 'CARD' && (contains(text, link.studentQuote) || contains(link.studentQuote, text)))
      return { key: `c${i}`, title: '고른 하고 싶은 일', text, rows }
    }),
    ...(input.interestText ? [{ key: 'i', title: '관심 분야 · 프로필', text: input.interestText, rows: usesOf((link) => link.basis === 'INTEREST') }] : []),
  ]
  if (blocks.length === 0) return null
  return <section className="fx-card tight rs-exp-card">
    <div className="rs-sec"><div><span className="rs-summary-kicker">YOUR STORY</span><h2>{title}</h2></div></div>
    <table className="rs-summary-table"><thead><tr><th scope="col">내가 적은 내용</th><th scope="col">이어진 공고와 근거</th></tr></thead><tbody>{blocks.map((block) => <tr key={block.key}>
      <td><div className="rs-quote"><small>{block.title}</small><Highlight text={block.text} quote={block.quote} /></div></td>
      <td><div className="rs-to">
        {block.rows.length === 0 && <b className="none">이어진 자리가 없어요</b>}
        {block.rows.length > 0 && <ul className="rs-uses">{block.rows.map((row) => <li key={row.key}><strong>{[row.item.institution?.name, row.item.title].filter(Boolean).join(' · ')}</strong><span>{row.link.jobQuote ? `“${row.link.jobQuote}”` : '공고 원문 칸에서 찾지 못했어요'}</span></li>)}</ul>}
      </div></td>
    </tr>)}</tbody></table>
  </section>
}
