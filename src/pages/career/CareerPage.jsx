import { useState } from 'react'
import { Link } from 'react-router-dom'
import { createCareerReport, deleteCareerReport, getCareerReport } from '../../api/career'
import { errorMessage, getToken } from '../../api/client'
import { getMyInternship } from '../../api/internship'
import { getMyPlan } from '../../api/plan'
import { label } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { ErrorBox, InstitutionLogo, Loading, NeedLogin } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, fmtDateTime } from '../../lib/format'
import './Career.css'

// 커리어 리포트 — 수행결과보고서 '실습 내용'(#34) → 다룬 NCS 능력단위 · 다음에 채울 것 · 한 단계 위 · 넓혀 갈 직무 · 이어지는 직업.
// 처음엔 저장본(#35, 없으면 404 → 작성 화면). 지우기는 #36.

const MIN = 100
const MAX = 3000
const SOURCES = '출처 · NCS 능력단위(한국산업인력공단) · 직업 연계(한국고용정보원 직업능력 코드매핑정보)'
const FALLBACK = { NO_KEY: 'AI 설정이 없어서', LIMITED: 'AI 호출 한도(계정당 1시간 10회)를 넘어서', AI_ERROR: 'AI가 제때 답하지 않아서', VERIFY_FAILED: 'AI가 고른 구절을 글에서 확인하지 못해서' }

const createError = (error) => {
  if (error.code === 'INVALID_INPUT' && error.fields?.length) return error.fields.map((f) => f.reason).join(' · ')
  if (error.code === 'CONSENT_REQUIRED') return '실습 내용을 AI에 보내고 저장하는 데 동의해 주세요.'
  if (error.code === 'JOB_NOT_FOUND') return '지금 회차에 없는 직무예요. 다른 직무를 골라 주세요.'
  return errorMessage(error, '정리하지 못했어요. 잠시 뒤 다시 해 주세요.')
}

// 작성 화면 — 실습한 직무 고르기(기본 = 매칭된 자리) · 실습 내용 붙여 넣기 · 동의 · [정리하기]
function CareerForm({ internship, plan, initial, onDone, onCancel }) {
  const placement = internship.data?.placement
  const options = []
  if (placement) options.push({ jobId: placement.jobId, title: placement.title, institution: placement.institution, note: `매칭된 자리${placement.team ? ` · ${placement.team}` : ''}` })
  for (const it of plan.data?.items ?? []) if (!options.some((o) => o.jobId === it.jobId)) options.push({ jobId: it.jobId, title: it.title, institution: it.institution, note: it.rank ? `${it.rank}지망 · 담은 직무` : '담은 직무' })
  if (initial?.jobId && !options.some((o) => o.jobId === initial.jobId)) options.unshift({ jobId: initial.jobId, title: initial.title, institution: initial.institution, note: '지난 리포트의 직무' })
  const [picked, setPicked] = useState(initial?.jobId ?? null)
  const jobId = picked ?? placement?.jobId ?? null
  const [text, setText] = useState(initial?.input?.practiceText ?? '')
  const [consent, setConsent] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const length = text.trim().length
  const lengthOk = length >= MIN && length <= MAX
  const loadingOptions = (internship.loading && !internship.data) || (plan.loading && !plan.data)

  const run = async () => {
    if (!jobId) { setError('실습한 직무를 골라 주세요.'); return }
    if (!lengthOk) { setError(`실습 내용은 ${MIN}~${MAX.toLocaleString('ko-KR')}자로 붙여 넣어 주세요.`); return }
    if (!consent) { setError('실습 내용을 AI에 보내고 저장하는 데 동의해 주세요.'); return }
    setRunning(true); setError('')
    try { onDone(await createCareerReport({ jobId, practiceText: text.trim() })) } catch (caught) { setError(createError(caught)); setRunning(false) }
  }

  if (running) return <Loading text="AI가 실습 내용에서 능력단위를 고르는 중…" note="약 10초 걸려요. 고른 구절이 내 글에 그대로 있는지 확인한 것만 남겨요." />

  return <div className="fx-split" style={{ marginTop: 0 }}>
    <section className="fx-card">
      {!placement && !loadingOptions && <div className="fx-callout" style={{ marginBottom: 18 }}><span className="fx-callout-icon">i</span><span>아직 매칭된 자리가 없어요. 실습을 마치고 수행결과보고서를 쓸 때 쓰는 화면이에요 — 지금은 담은 직무로 미리 해 볼 수 있어요.</span></div>}
      <div className="cr-step"><h3>1. 실습한 직무</h3><p>리포트는 그 직무의 NCS 세분류 능력단위로 정리해요. 수행결과보고서 냄 표시는 매칭된 자리의 리포트가 있어야 해요.</p>
        {loadingOptions ? <p className="fx-small" style={{ marginTop: 10 }}>직무를 불러오는 중…</p>
          : options.length === 0 ? <p className="fx-small" style={{ marginTop: 10 }}>매칭된 자리나 담은 직무가 없어요. <Link className="v2-link" to="/jobs">직무 찾기 →</Link></p>
            : <div className="cr-jobs">{options.map((o) => <button key={o.jobId} type="button" className={`cr-job ${o.jobId === jobId ? 'on' : ''}`} aria-pressed={o.jobId === jobId} onClick={() => setPicked(o.jobId)}><InstitutionLogo institution={o.institution} /><div><small>{o.institution?.name}</small><b>{o.title}</b><em>{o.note}</em></div></button>)}</div>}
      </div>
      <div className="cr-step"><h3>2. 수행결과보고서 · 실습 내용</h3><p>별지 제9호의 '실습 내용' 칸을 붙여 넣어요. 핵심 담당 실습 내용을 중심으로 실습기간 중 진행한 업무와 주어진 역할 · 과제를 자세히 쓰면 더 많이 찾아요. 이름은 쓰지 말아 주세요.</p>
        <textarea className="fx-textarea" aria-label="실습 내용" value={text} maxLength={MAX + 200} placeholder="예) 5주차부터 경쟁사 신제품의 가격과 구성을 표로 정리해 신제품 기획 회의에 냈어요. 매주 SNS 게시물 반응을 집계해 콘텐츠 회의 자료를 만들었어요." onChange={(event) => { setText(event.target.value); setError('') }} />
        <div className="fx-row between" style={{ marginTop: 8 }}><span className="fx-small">{MIN}~{MAX.toLocaleString('ko-KR')}자 · 전화번호 · 이메일 · 학번 같은 숫자는 [가림]으로 바꿔 보내요</span><span className={`fx-count ${lengthOk ? 'ok' : 'short'}`}>{length.toLocaleString('ko-KR')} / {MAX.toLocaleString('ko-KR')}자</span></div>
      </div>
      <label className="cr-consent"><input type="checkbox" checked={consent} onChange={(event) => { setConsent(event.target.checked); setError('') }} /><span>실습 내용을 AI(Claude)에 보내 능력단위를 고르고, 결과와 함께 저장하는 데 동의해요. 학과 · 학년 · 평점은 보내지 않아요. 계정당 마지막 1건만 두고, 지우기 · 탈퇴하면 바로 지워져요.</span></label>
      {error && <p className="cr-error" role="alert">{error}</p>}
      <div className="cr-actions"><button type="button" className="fx-btn primary lg" onClick={run}><span className="v2-ai">AI</span>정리하기</button>{onCancel && <button type="button" className="fx-btn lg" onClick={onCancel}>취소</button>}</div>
    </section>
    <aside className="fx-aside">
      <section className="fx-card tight"><h3 className="fx-h3">AI가 하는 일</h3>
        <ol className="fx-ol" style={{ marginTop: 12 }}>
          <li><span className="fx-n">1</span><span>실습 내용과 그 직무 세분류의 능력단위(이름 · 정의)만 읽어요.</span></li>
          <li><span className="fx-n">2</span><span>실습에서 해 본 능력단위마다 내 글의 구절과 이유 한 문장을 골라요.</span></li>
          <li><span className="fx-n">3</span><span>구절이 내 글 한 문장 안에 그대로 있는지 서버가 확인한 것만 남겨요.</span></li>
        </ol></section>
      <section className="fx-card tight"><h3 className="fx-h3">AI가 답하지 못하면</h3><p className="fx-sub" style={{ margin: '8px 0 0' }}>능력단위 목록만 보여 줘요. 전에 만든 AI 리포트가 있으면 잠깐의 실패로 덮어쓰지 않아요.</p></section>
    </aside>
  </div>
}

// 커리어 리포트 결과 — "이번 실습으로 무엇을 말할 수 있나" 하나에 답한다.
// ① 찾은 능력(내 글 구절 · 이유) ② 다음에 해 보면 좋은 일 ③ 넓혀 갈 직무와 일자리 ④ 글에 안 나온 능력(접어 둠).
// NCS 수준 숫자·채운 비율은 보여 주지 않는다(분모가 직무 표준 전체라 '부족'으로 읽혀서).
function Report({ report, internship, codes, onRedo, onDelete }) {
  const data = internship.data
  const placement = data?.placement
  const mine = placement && placement.jobId === report.jobId
  const documents = mine ? data?.documents : null
  const covered = report.covered
  const next = report.nextLevel?.units ?? []
  const draft = report.expand.some((e) => e.linked?.some((u) => u.checked === false))
  const nowJobs = new Set((report.occupations ?? []).map((o) => o.code))
  const L = (group, code) => label(codes, group, code)
  return <>
    {report.keptReason && <div className="fx-callout warn" style={{ marginBottom: 14 }}><span className="fx-callout-icon">!</span><span>지금은 AI가 답하지 않아 전에 만든 리포트를 보여 줘요. 잠시 뒤 다시 해 주세요.</span></div>}
    {report.source === 'NONE' && <div className="fx-callout warn" style={{ marginBottom: 14 }}><span className="fx-callout-icon">!</span><span>{FALLBACK[report.fallbackReason] ?? ''} 이번에는 능력을 고르지 못했어요. 잠시 뒤 [다시 만들기]로 다시 해 주세요.</span></div>}

    <section className="cr2-hero">
      <div>
        <span className="fx-kicker">커리어 리포트 · {report.institution?.name} {report.title}</span>
        <h1 className="fx-h1">{covered.length > 0 ? <>실습 내용에서 <span className="fx-blue">능력 {covered.length}가지</span>를 찾았어요</> : '실습 내용에서 찾은 능력이 아직 없어요'}</h1>
        <p className="fx-lead">수행결과보고서 '실습 내용'에서 근거 구절이 그대로 있는 것만 골랐어요. 기준은 NCS '{report.ncs?.name}'이에요. {fmtDateTime(report.createdAt)} 정리</p>
      </div>
      {documents && <div className="cr-done">
        <div>결과보고서(제9호){documents.report ? <span className="badge green">{fmtDate(documents.report)} 냄</span> : <Link to="/internship">냄 표시하기 →</Link>}</div>
        <div>학점인정신청서<span className={`badge ${documents.credit ? 'green' : 'gray'}`}>{documents.credit ? `${fmtDate(documents.credit)} 냄` : '아직'}</span></div>
      </div>}
    </section>

    <section className="fx-card cr2-block">
      <div className="cr2-head"><h2>이번 실습으로 말할 수 있는 것</h2><span className="v2-ai">AI</span></div>
      <p className="cr2-sub">이력서 · 면접에서 "무엇을 해 봤나"에 이렇게 답할 수 있어요. 능력 이름 아래가 그 근거가 된 내 글이에요(마우스를 올리면 AI가 쓴 이유).</p>
      {covered.length === 0
        ? <p className="cr2-empty">맡은 일과 결과를 문장마다 구체적으로 쓰면 더 많이 찾아요. [다시 만들기]로 보완해 보세요.</p>
        : <ul className="cr2-units">{covered.map((u) => <li key={u.code} title={u.reason}>
          <b>{u.name}</b>
          <q>{u.studentQuote}</q>
        </li>)}</ul>}
    </section>

    <div className="cr2-two">
      <section className="fx-card cr2-block">
        <div className="cr2-head"><h2>다음에 해 보면 좋은 일</h2></div>
        <p className="cr2-sub">같은 직무에서 아직 글에 없던 일 중, 지금 한 일과 난이도가 가까운 것부터 골랐어요.</p>
        {next.length ? <ol className="cr2-next">{next.map((u) => <li key={u.code}>{u.name}</li>)}</ol> : <p className="cr2-empty">이 직무의 능력을 모두 찾았어요.</p>}
      </section>
      <section className="fx-card cr2-block">
        <div className="cr2-head"><h2>실습 뒤 넓혀 갈 직무</h2></div>
        <p className="cr2-sub">내가 한 일과 많이 이어지는 직무부터예요.</p>
        <div className="cr2-paths">{report.expand.map((e) => <article key={e.code}>
          <div className="cr2-path-top"><b>{e.name}</b><small>{L('ncsRelation', e.relation)}</small></div>
          {e.linked?.length > 0
            ? <p className="cr2-link">내가 한 <em>{e.linked[0].from?.name}</em>{e.linked.length > 1 ? ` 등 ${e.linked.length}가지` : ''}가 이 직무의 <em>{e.linked[0].name}</em>{e.linked.length > 1 ? ' 등' : ''}으로 이어져요.</p>
            : <p className="cr2-link muted">아직 내가 한 일과 바로 이어지는 능력은 없어요.</p>}
          {(() => { const extra = (e.occupations ?? []).filter((o) => !nowJobs.has(o.code)); return extra.length > 0 && <p className="cr2-occ">더 갈 수 있는 일자리 · {extra.slice(0, 3).map((o) => o.name).join(' · ')}</p> })()}
        </article>)}</div>
        {report.occupations?.length > 0 && <p className="cr2-occ cr2-occ-now">지금 직무로 갈 수 있는 일자리 · {report.occupations.slice(0, 4).map((o) => o.name).join(' · ')}</p>}
      </section>
    </div>

    {report.notCovered.length > 0 && <details className="fx-card cr2-fold">
      <summary>이번 글에 나오지 않은 능력 {report.notCovered.length}가지 <small>펼치기</small></summary>
      <p className="cr2-sub">자리마다 하는 일이 달라 다 채울 필요는 없어요. 실습에서 했는데 글에 빠졌다면 보고서에 더 자세히 쓰고 다시 만들어 보세요.</p>
      <div className="cr2-chips">{report.notCovered.map((u) => <span key={u.code}>{u.name}</span>)}</div>
    </details>}

    <div className="cr-actions">
      <button type="button" className="fx-btn primary" onClick={onRedo}>다시 만들기</button>
      <button type="button" className="fx-btn danger-line" onClick={onDelete}>지우기</button>
      {placement && <Link className="fx-btn ghost" to="/internship">내 현장실습으로 →</Link>}
    </div>
    <p className="v2-muted" style={{ margin: '16px 0 0' }}>출처 · NCS 능력단위(한국산업인력공단) · 직업 연계(한국고용정보원 직업능력 코드매핑정보) · 넓혀 갈 직무는 팀이 고른 것{draft ? ' · 직무끼리 이어지는 능력은 AI가 만든 연결을 팀이 확인하고 있어요' : ''}</p>
  </>
}

export function CareerPage() {
  const loggedIn = Boolean(getToken())
  const report = useRequest(getCareerReport, loggedIn)
  const internship = useRequest(getMyInternship, loggedIn)
  const plan = useRequest(getMyPlan, loggedIn)
  const codes = useCodes()
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  if (!loggedIn) return <NeedLogin />
  const notFound = report.error?.code === 'CAREER_REPORT_NOT_FOUND'
  const result = report.data
  const showForm = editing || (!result && (notFound || (!report.loading && !report.error)))

  const remove = async () => {
    setDeleting(true); setDeleteError('')
    try { await deleteCareerReport(); report.mutate(null); setAsking(false); internship.reload() } catch (caught) { setDeleteError(errorMessage(caught, '지우지 못했어요. 잠시 뒤 다시 해 주세요.')) } finally { setDeleting(false) }
  }

  return <main className="fx-page"><div className="fx-shell">
    {showForm && <div className="v2-page-head"><header className="page-title"><span className="fx-kicker">Career report</span><h1 className="fx-h1">실습에서 한 일을 능력으로 정리해요</h1><p className="fx-lead">수행결과보고서의 '실습 내용'을 붙여 넣으면, 이번 실습으로 말할 수 있는 능력과 다음에 해 볼 일, 넓혀 갈 직무를 보여 줘요.</p></header></div>}
    {report.loading && !result && !report.error ? <Loading text="커리어 리포트를 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." />
      : report.error && !notFound ? <ErrorBox error={report.error} retry={report.reload} />
        : showForm ? <CareerForm key={result?.reportId ?? 'new'} internship={internship} plan={plan} initial={editing ? result : null} onCancel={editing ? () => setEditing(false) : null} onDone={(created) => { report.mutate(created); setEditing(false); internship.reload(); window.scrollTo({ top: 0 }) }} />
          : <Report report={result} internship={internship} codes={codes} onRedo={() => { setEditing(true); window.scrollTo({ top: 0 }) }} onDelete={() => { setDeleteError(''); setAsking(true) }} />}
    <p className="v2-muted" style={{ margin: '18px 0 0', display: showForm ? 'block' : 'none' }}>{SOURCES}</p>
    {asking && <Modal close={() => !deleting && setAsking(false)}>{(dismiss) => <>
      <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>커리어 리포트를 지울까요?</h2>
      <p>리포트와 붙여 넣은 실습 내용이 함께 지워지고 되돌릴 수 없어요. 수행결과보고서 냄 표시는 리포트가 있어야 해요.</p>
      {deleteError && <p className="danger" role="alert">{deleteError}</p>}
      <div className="fx-row" style={{ justifyContent: 'center', marginTop: 16 }}><button type="button" className="fx-btn" disabled={deleting} onClick={dismiss}>취소</button><button type="button" className="fx-btn primary" style={{ background: '#c53535', borderColor: '#c53535', boxShadow: 'none' }} disabled={deleting} onClick={remove}>{deleting ? '지우는 중…' : '지우기'}</button></div>
    </>}</Modal>}
  </div></main>
}
