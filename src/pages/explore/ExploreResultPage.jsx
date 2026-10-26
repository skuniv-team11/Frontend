import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '../../api/client'
import { deleteMyExplore, getMyExplore } from '../../api/explore'
import { getJobCareer } from '../../api/jobs'
import { addPlanItem, getMyPlan, planErrorMessage, removePlanItem } from '../../api/plan'
import { label } from '../../api/reference'
import { Modal } from '../../components/Shell'
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
  const [busyJob, setBusyJob] = useState(null)
  const [planMessage, setPlanMessage] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const data = explore.data
  const items = data?.items ?? []
  const pathJobId = selectedJob ?? items[0]?.jobId ?? null
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
        <h1>{items.length ? `나에게 맞는 현장실습 ${items.length}곳이에요` : '이어진 근거가 있는 자리가 없어요'}</h1>
        <p>{data.fallbackReason === 'NO_CANDIDATES' ? '지금 프로필로는 지원할 수 있는 마감 전 자리가 없어 AI를 부르지 않았어요.' : rule ? `AI 대신 규칙 추천으로 골랐어요 — ${fallback ?? '규칙 추천'}.` : '지원 조건을 맞춘 자리만 놓고, AI가 내 글(해 본 일 · 고른 일 · 관심 분야)과 자리 설명을 함께 읽어 짝을 찾았어요.'}</p>
      </header>
      <div className="fx-row" style={{ gap: 8 }}>
        <button type="button" className="v2-btn sm gray" onClick={() => setAskDelete(true)}>결과 지우기</button>
        <Link className="v2-btn sm gray" to="/explore">다시 탐색하기</Link>
        <Link className="v2-btn sm" to="/jobs">직무 찾기에서 보기 →</Link>
      </div>
    </div>

    <section className="rs-funnel" aria-label="고른 순서">
      <div className="rs-fstep"><small>① 지원 조건 확인 · 규칙</small><b>{candidates.total}개 자리</b><p>지원 가능 {candidates.eligible} · 확인 필요 {candidates.needsCheck}. 지원 불가 · 마감 자리는 AI에 넘기지 않아요</p></div><span aria-hidden="true">→</span>
      <div className="rs-fstep"><small>② 짝 찾기 · {rule ? '규칙 추천' : 'AI + 검증'}</small><b>{rule ? 'AI 대신 규칙 추천' : `내 글 ↔ ${candidates.total}곳 설명`}</b><p>{rule ? `${fallback ?? ''} · 지원 조건과 적합도 점수(전공 · 관심 분야)로 골랐어요` : '같은 일 · 해 본 일이 쓰이는 일 · 하고 싶은 일로 짝을 짓고, 구절이 원문에 그대로 있는지 코드가 확인해요'}</p></div><span aria-hidden="true">→</span>
      <div className="rs-fstep end"><small>③ 순서 · 규칙</small><b>{items.length}곳</b><p>{data.hiddenCount > 0 ? `지금 프로필로 다시 판정해 ${data.hiddenCount}곳은 숨겼어요` : '위에서 5곳까지 보여 줘요'}</p></div>
    </section>

    <p className="rs-order"><b>순서</b>{ORDER_RULE}</p>

    <div className="rs-notes">
      {rule && items.length > 0 && <div className="fx-callout warn"><span className="fx-callout-icon">!</span><div><b>{fallback ?? 'AI를 쓰지 못해'} — 규칙 추천으로 대신했어요.</b> AI가 이은 근거가 없어서 자리마다 '{label(codes, 'exploreFit', 'NONE')}'으로 보이고 짝 목록이 없어요. 운영계획서 근거 인용만 함께 보여 줘요.{data.fallbackReason === 'LIMITED' && ' 탐색 한도(계정당 1시간 10회)를 넘었어요. 잠시 뒤 다시 탐색해 보세요.'}</div></div>}
      {data.judgedWith === 'SAVED_PROFILE' && data.hiddenCount > 0 && <div className="fx-callout"><span className="fx-callout-icon">i</span><div><b>저장한 프로필로 다시 판정해 지금은 후보가 아닌 {data.hiddenCount}곳을 숨겼어요.</b> 순위는 남은 자리끼리 다시 매겼어요. 프로필을 바꿨다면 다시 탐색해 보세요.</div></div>}
    </div>

    {items.length === 0
      ? <EmptyResult data={data} rule={rule} />
      : <>
        <div className="rs-sec"><h2>맞는 현장실습</h2><small>{label(codes, 'exploreJudgedWith', data.judgedWith)} · 다른 학생이 몇 명 담았는지는 보여 주지 않아요</small></div>
        {planMessage && <p className="rs-msg" role="alert" style={{ marginBottom: 10 }}>{planMessage}</p>}
        <section className="rs-seats">
          {items.map((item) => <SeatCard key={item.jobId} item={item} codes={codes} input={input} rule={rule}
            selected={item.jobId === pathJobId} onSelect={() => setSelectedJob(item.jobId)}
            saved={plannedIds.has(item.jobId)} planReady={Boolean(plan.data)} busy={busyJob === item.jobId} onToggle={() => togglePlan(item)} />)}
        </section>
        {pathItem && <CareerPath item={pathItem} career={career} codes={codes} />}
      </>}

    <InputSummary input={input} items={items} title={items.length ? '내 글이 이어진 곳' : '탐색에 쓴 내 글'} />

    <div className="rs-note"><p>지원 조건은 규칙이 먼저 판정하고, AI는 지원할 수 있는 자리만 읽어요(학과 · 학년 · 평점은 AI에 보내지 않아요). AI가 지은 짝은 인용 구절을 원문과 맞춰 본 것만 보여 주고, 순서는 규칙이 정해요.<br />결과는 계정당 마지막 1건만 저장하고, 볼 때마다 다시 계산하지 않아요. 판정은 지금 저장한 프로필로 다시 봐요.</p><Link className="v2-link" to="/explore">다시 탐색하기 →</Link></div>

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

function SeatCard({ item, codes, input, rule, selected, onSelect, saved, planReady, busy, onToggle }) {
  const evidence = item.evidence ?? {}
  const links = item.links ?? []
  const why = item.why
  return <article className={`rs-seat ${selected ? 'on' : ''}`}>
    <div className="rs-top">
      <span className="rs-logo"><InstitutionLogo institution={item.institution} /></span>
      <div><small>{item.institution?.name}{item.team ? ` · ${item.team}` : ''}</small><h3><Link to={`/jobs/${item.jobId}`}>{item.title}</Link></h3></div>
      <span className="rs-rank">{item.rank}위</span>
    </div>
    <div className="rs-tags">
      <VerdictBadge verdict={item.verdict} />
      <span className={`rs-fit ${item.fit}`}>{label(codes, 'exploreFit', item.fit)}</span>
      {evidence.basis && <span className={`v2-src ${BASIS_CLS[evidence.basis] ?? ''}`}>근거 · {label(codes, 'exploreBasis', evidence.basis)}</span>}
    </div>
    {evidence.reason && <p className="rs-reason">{evidence.reason}</p>}
    <div className="rs-body">
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
    </div>
    <div className="rs-foot">
      <Link className="v2-link" to={`/jobs/${item.jobId}`}>직무 상세 보기 →</Link>
      <div>
        <button type="button" className={`rs-pick ${selected ? 'on' : ''}`} onClick={onSelect}>{selected ? '실습 뒤 길 보는 중' : '실습 뒤 길 보기'}</button>
        <button type="button" className={`v2-btn sm ${saved ? '' : 'line'}`} disabled={busy || !planReady} onClick={onToggle} title={saved ? '다시 누르면 담기를 취소해요' : undefined}>{busy ? '처리 중…' : saved ? '담김 ✓' : '담기'}</button>
      </div>
    </div>
  </article>
}

function CareerPath({ item, career, codes }) {
  const data = career.data
  const ncs = data?.ncs
  return <section className="rs-path">
    <header><div><span>AFTER PRACTICE</span><h2>{item.institution?.name} {item.title} — 실습 뒤 넓혀 갈 직무 · 일자리</h2></div><span className="fx-small">{item.rank}위 자리 기준 · 다른 자리는 [실습 뒤 길 보기]로 바꿔요</span></header>
    {career.loading && !data && <Loading text="실습 뒤 길을 불러오는 중…" />}
    {career.error && <ErrorBox error={career.error} retry={career.reload} />}
    {data && !ncs && <p className="rs-empty-why">이 직무는 아직 이어지는 길을 정리하지 않았어요.</p>}
    {data && ncs && <>
      <div className="v2-flow">
        <div className="v2-flow-col"><span>① 이 자리에서</span><h4>쓰는 능력 {ncs.units?.length ?? 0}가지</h4>
          <small className="v2-muted" style={{ marginTop: -6 }}>NCS '{ncs.name}' 기준</small>
          <ul>{(ncs.units ?? []).slice(0, 5).map((unit) => <li key={unit.code}>{unit.name}</li>)}</ul>
          {(ncs.units?.length ?? 0) > 5 && <small className="v2-muted">외 {ncs.units.length - 5}개</small>}
        </div>
        <span className="v2-arrow" aria-hidden="true">→</span>
        <div className="v2-flow-col is-here"><span>② 실습 뒤</span><h4>넓혀 갈 직무</h4>
          <div className="fx-stack" style={{ gap: 8 }}>{(data.expand ?? []).map((row) => <div key={row.code} className="v2-next">
            <b>{row.name}</b>
            <small>{label(codes, 'ncsRelation', row.relation)}{row.occupations?.length ? ` · 일자리 예: ${row.occupations.slice(0, 3).map((o) => o.name).join(', ')}` : ''}</small>
          </div>)}</div>
          {(data.expand?.length ?? 0) === 0 && <p className="v2-muted" style={{ margin: 0 }}>고른 넓혀 갈 직무가 없어요.</p>}
        </div>
        <span className="v2-arrow" aria-hidden="true">→</span>
        <div className="v2-flow-col"><span>③ 취업</span><h4>이어지는 일자리</h4>
          {(data.occupations?.length ?? 0) > 0
            ? <div className="rs-jobs">{data.occupations.slice(0, 8).map((o) => <b key={o.code}>{o.name}</b>)}</div>
            : <p className="v2-muted" style={{ margin: 0 }}>연계표에 맞는 직업이 없어요.</p>}
        </div>
      </div>
      <p className="rs-src-note">출처 · NCS 능력단위(한국산업인력공단) · 직업 연계(한국고용정보원 직업능력 코드매핑정보) · 넓혀 갈 직무는 팀이 고른 것</p>
    </>}
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
  const places = (rows) => new Set(rows.map((row) => row.item.jobId)).size
  // '왜 맞나요' 설명에 쓰인 자리(짝과 따로 — AI가 설명을 쓰며 인용한 내 글)
  const whyTitles = (text) => items.filter((item) => (item.why?.points ?? []).some((point) => contains(text, point.studentQuote))).map((item) => item.title)
  const blocks = [
    ...(input.experiences ?? []).map((text, i) => {
      const rows = usesOf((link) => link.basis === 'EXPERIENCE' && contains(text, link.studentQuote))
      const whyPoint = items.flatMap((item) => item.why?.points ?? []).find((point) => contains(text, point.studentQuote))
      return { key: `e${i}`, title: `경험 ${i + 1} · 원문`, text, quote: rows[0]?.link.studentQuote ?? whyPoint?.studentQuote, rows, why: whyTitles(text) }
    }),
    ...(input.cards ?? []).map((text, i) => {
      const rows = usesOf((link) => link.basis === 'CARD' && (contains(text, link.studentQuote) || contains(link.studentQuote, text)))
      return { key: `c${i}`, title: '고른 하고 싶은 일', text, rows }
    }),
    ...(input.interestText ? [{ key: 'i', title: '관심 분야 · 프로필', text: input.interestText, rows: usesOf((link) => link.basis === 'INTEREST') }] : []),
  ]
  if (blocks.length === 0) return null
  return <section className="fx-card tight rs-exp-card">
    <div className="rs-sec"><h2><span className="v2-ai">AI</span> {title}</h2><small>저장한 입력(번호 모양은 [가림]) · 인용 구절이 내 글과 공고에 그대로 있는 것만 남겼어요</small></div>
    <div className="rs-exps">{blocks.map((block) => <div key={block.key} className="rs-exp">
      <div className="rs-quote"><small>{block.title}</small><Highlight text={block.text} quote={block.quote} /></div>
      <div className="rs-to">
        {block.rows.length > 0 ? <b>→ {places(block.rows)}곳에 이어졌어요</b> : <b className="none">{block.why?.length ? '짝으로 이어진 자리는 없어요' : '이어진 자리가 없어요'}</b>}
        {block.rows.length > 0 && <ul className="rs-uses">{block.rows.map((row) => <li key={row.key}><span>{row.item.title}</span>{row.link.jobQuote ? `“${row.link.jobQuote}”` : '공고 원문 칸에서 찾지 못했어요'}</li>)}</ul>}
        {block.why?.length > 0 && <p className="rs-why-use">'왜 맞나요'에서 쓰였어요 · {block.why.join(' · ')}</p>}
      </div>
    </div>)}</div>
  </section>
}
