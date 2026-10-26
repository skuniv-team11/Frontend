import { useState } from 'react'
import { Link } from 'react-router-dom'
import { confirmPlacement, getPlacement, notifyPlacement, setMatch, setSelection } from '../../api/center'
import { getCurrentRound, label } from '../../api/reference'
import { Empty, ErrorBox, Loading, VerdictBadge, VirtualTag } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDateTime } from '../../lib/format'
import { CenterDemoBanner, ErrorLine, md, stageRange, studentLine, useDemoReload } from './centerKit'
import './CenterPage.css'
import './CenterV2.css'

const RESULTS = [['WAIT', 'wait'], ['PASS', 'pass'], ['FAIL', 'fail']]
const MODES = ['IN_PERSON', 'ONLINE', 'PHONE']

// 서버 시각(+09:00) ↔ <input type="datetime-local"> 값(한국 시간)
const toLocalInput = (iso) => {
  if (!iso) return ''
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ''
  return new Date(time + 9 * 3600000).toISOString().slice(0, 16)
}
const toIso = (local) => (local ? `${local}:00+09:00` : null)
const pickText = (pick) => `${pick.institution?.name ?? ''} · ${pick.title}`

export function CenterMatchPage() {
  const codes = useCodes()
  const placement = useRequest(getPlacement)
  const round = useRequest(getCurrentRound)
  useDemoReload(placement.reload)
  const [tab, setTab] = useState(null)
  const data = placement.data
  const active = tab ?? (data?.confirmedAt ? 'select' : 'match')
  const r = round.data
  const kicker = r ? `${r.termCode} · 매칭 ${stageRange(r, 'MATCH')} · 면접 · 선발 ${stageRange(r, 'SELECT')}` : '매칭 · 선발'
  const tabs = [['match', `매칭${r ? ` · ${stageRange(r, 'MATCH')}` : ''}`], ['select', `면접 · 선발${r ? ` · ${stageRange(r, 'SELECT')}` : ''}`]]

  return <main className="center-page cv2 cv2-flow">
    <CenterDemoBanner note="기관 계정은 없어요 · 기관이 알려 준 면접 일정과 결과를 센터가 넣어요" />
    <div className="center-head">
      <header className="page-title"><span>{kicker}</span><h1>{active === 'match' ? '1~3지망 중 한 기관에 매칭해요' : '기관 면접 결과를 넣어요'}</h1></header>
      <div className="c-tabs" role="tablist">{tabs.map(([key, text]) => <button key={key} type="button" role="tab" aria-selected={active === key} className={active === key ? 'on' : ''} onClick={() => setTab(key)}>{text}</button>)}</div>
    </div>
    {!data ? (placement.error ? <ErrorBox error={placement.error} fallback="매칭 · 선발을 불러오지 못했어요." retry={placement.reload} /> : <Loading text="매칭 · 선발을 불러오는 중…" note="서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요." />)
      : <>
        {placement.error && <ErrorBox error={placement.error} fallback="다시 불러오지 못했어요." retry={placement.reload} />}
        {active === 'match'
          ? <MatchTab data={data} mutate={placement.mutate} reload={placement.reload} keepTab={() => setTab('match')} />
          : <SelectTab data={data} codes={codes} mutate={placement.mutate} reload={placement.reload} toMatch={() => setTab('match')} />}
      </>}
  </main>
}

function MatchTab({ data, mutate, reload, keepTab }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState('')
  const confirmed = Boolean(data.confirmedAt)
  const { counts } = data
  const waiting = data.applicants.filter((a) => a.status === 'RECEIVED' && a.matchedRank == null)

  const run = async (key, call) => {
    setBusy(key); setError(null); setDone('')
    try { const next = await call(); if (next) mutate(next); return next } catch (caught) { setError(caught); return null } finally { setBusy(null) }
  }
  const choose = (a, rank) => run(a.applicationId, () => setMatch(a.applicationId, rank))
  // 시연 — 아직 고르지 않은 접수 완료 지원서를 첫 지망으로 고른다(#50을 차례로 부름)
  const fillFirst = () => run('fill', async () => {
    let next = null
    for (const a of waiting) next = await setMatch(a.applicationId, a.picks[0]?.rank ?? 1)
    return next
  })
  const confirm = async () => {
    keepTab()
    const next = await run('confirm', () => confirmPlacement())
    if (next) setDone(`매칭을 확정했어요. 학생 ${next.counts.matched}명의 내 현장실습 타임라인에 '매칭'이 보여요.`)
  }

  return <>
    <section className="metrics c4">{[['접수 완료', `${counts.received}명`], ['보완 중', `${counts.fixRequested}명`], ['매칭함', `${counts.ranked} / ${counts.received}명`], ['기관', `${counts.institutions}곳`]].map(([name, value]) => <div key={name}><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard">
      <div className="fx-stack">
        {confirmed && <div className="cm-done"><span>✓ {fmtDateTime(data.confirmedAt)} 매칭 확정 · 학생 {counts.matched}명에게 보여요. 이제 매칭을 바꿀 수 없어요.</span><Link className="v2-link" to="/internship">학생 화면 →</Link></div>}
        {data.applicants.length === 0 ? <Empty title="매칭할 지원서가 없어요" action={<Link className="fx-btn" to="/center/inbox">접수함으로</Link>}>접수함에서 [접수]한 지원서가 여기에 와요.</Empty>
          : <section className="fx-table">
            <div className="fx-thead cm-cols"><span>학생</span><span>{confirmed ? '1~3지망' : '1~3지망 · 눌러서 매칭'}</span><span>상담</span><span>매칭</span></div>
            {data.applicants.map((a) => {
              const fixing = a.status === 'FIX_REQUESTED'
              const locked = confirmed || fixing || a.status === 'MATCHED' || Boolean(busy)
              return <div key={a.applicationId} className="fx-tr cm-cols cm-row">
                <span><b>{a.student?.nameKo}</b><VirtualTag show={a.virtual} /><small>{studentLine(a.student)}</small><small>{a.receiptNo}</small></span>
                <span className="cm-picks">{a.picks.map((pick) => {
                  const on = a.matchedRank === pick.rank
                  return <button key={pick.rank} type="button" className={`cm-pick ${on ? 'on' : ''}`} disabled={locked} aria-pressed={on} title={on ? '한 번 더 누르면 취소' : undefined} onClick={() => choose(a, on ? null : pick.rank)}>
                    <span><b>{pick.rank}지망</b>{pickText(pick)}</span><VerdictBadge verdict={pick.verdict} />
                  </button>
                })}</span>
                <span>{a.counselCount > 0 ? `${a.counselCount}회` : '-'}</span>
                <span className="cm-sel">{fixing ? <>보완 중<small>보완이 끝나면 매칭해요</small></>
                  : a.matchedJob ? <>{a.matchedJob.institution?.name} · {a.matchedJob.title}<small>{a.matchedRank}지망으로 매칭{a.status === 'MATCHED' ? ' · 확정' : ''}</small>{!confirmed && a.status !== 'MATCHED' && <button type="button" disabled={Boolean(busy)} onClick={() => choose(a, null)}>{busy === a.applicationId ? '바꾸는 중…' : '매칭 취소'}</button>}</>
                  : <>{busy === a.applicationId ? '고르는 중…' : '아직'}<small>{confirmed ? '확정 때 빠졌어요' : '지망 하나를 눌러요'}</small></>}</span>
              </div>
            })}
          </section>}
      </div>
      <aside className="fx-stack">
        <section className="fx-card tight"><h3 className="fx-h3">직무별 매칭 · 정원</h3>
          <p className="fx-small" style={{ marginBottom: 8 }}>마감 뒤 센터만 봐요. 정원을 넘겨도 매칭할 수 있어요 — 면접에서 기관이 뽑아요.</p>
          {data.jobs.length === 0 ? <p className="cv2-hint">아직 고른 매칭이 없어요.</p> : data.jobs.map((job) => <div key={job.jobId} className="cm-cap"><span>{job.title}<small>{job.institution?.name}{job.team ? ` · ${job.team}` : ''}</small></span><span className={`badge ${job.matched > job.headcount ? 'orange' : 'gray'}`}>{job.matched} / 정원 {job.headcount}</span></div>)}
        </section>
        <section className="fx-card tight"><h3 className="fx-h3">매칭 기준</h3><p className="fx-small">센터가 기관 요구사항 · 이력서 · 자기소개서를 보고 정해요. 화면은 지원 조건 판정과 상담 이수(가점)만 옆에 보여 주고, 순위를 매기지 않아요.</p></section>
        <section className="fx-card tight"><h3 className="fx-h3">매칭 확정</h3>
          <p className="fx-small">{confirmed ? `${fmtDateTime(data.confirmedAt)}에 확정했어요. 다음은 면접 · 선발이에요.` : `접수 완료 ${counts.received}명 중 ${counts.ranked}명을 골랐어요. 모두 고르면 확정할 수 있어요(보완 중인 학생은 빼요). 확정하면 학생에게 바로 보이고 더는 바꿀 수 없어요.`}</p>
          <div className="fx-row wrap" style={{ gap: 8, marginTop: 10 }}>
            {!confirmed && waiting.length > 0 && <button type="button" className="fx-btn sm c-demo" disabled={Boolean(busy)} onClick={fillFirst}>{busy === 'fill' ? '고르는 중…' : '시연 · 첫 지망으로 채우기'}</button>}
            <button type="button" className={`fx-btn sm ${confirmed ? 'dark' : 'primary'}`} disabled={confirmed || Boolean(busy)} onClick={confirm}>{confirmed ? '✓ 매칭 확정 · 학생에게 보임' : busy === 'confirm' ? '확정하는 중…' : '매칭 확정 · 학생에게 알림'}</button>
          </div>
          <ErrorLine error={error} />
          {done && <p className="cv2-ok" role="status">{done}</p>}
          {!confirmed && <button type="button" className="link-button" style={{ fontSize: 12, paddingBottom: 0 }} onClick={reload}>다시 불러오기</button>}
        </section>
      </aside>
    </div>
  </>
}

function SelectionRow({ a, codes, locked, save, saving }) {
  const [at, setAt] = useState(toLocalInput(a.interview?.at))
  const [mode, setMode] = useState(a.interview?.mode ?? 'IN_PERSON')
  const notified = Boolean(a.notifiedAt)
  const commit = (result, nextAt = at, nextMode = mode) => save(a, { interviewAt: toIso(nextAt), interviewMode: nextAt ? nextMode : null, result })
  const savedAt = toLocalInput(a.interview?.at)
  return <div className="fx-tr cs-cols cm-row">
    <span><b>{a.student?.nameKo}</b><VirtualTag show={a.virtual} /><small>{studentLine(a.student)}</small><small>{a.receiptNo}</small></span>
    <span>{a.matchedJob?.title}<small>{a.matchedJob?.institution?.name} · {a.matchedRank}지망</small></span>
    <span className="cs-iv">{notified || locked
      ? <span>{a.interview?.at ? `${fmtDateTime(a.interview.at)} · ${label(codes, 'interviewMode', a.interview.mode)}` : '일정 없음'}</span>
      : <>
        <input type="datetime-local" aria-label={`${a.student?.nameKo} 면접 일정`} value={at} onChange={(event) => setAt(event.target.value)} onBlur={() => { if (at !== savedAt) commit(a.result) }} />
        <div><select aria-label="면접 방식" value={mode} onChange={(event) => { setMode(event.target.value); if (at) commit(a.result, at, event.target.value) }}>{MODES.map((code) => <option key={code} value={code}>{label(codes, 'interviewMode', code)}</option>)}</select></div>
        <small className="fx-small">{saving ? '저장 중…' : a.interview?.at ? '기관에서 받은 일정' : '기관에서 받기 전'}</small>
      </>}</span>
    <span className="cs-res">{RESULTS.map(([code, tone]) => <button key={code} type="button" className={`${a.result === code ? 'on ' : ''}${tone}`} disabled={notified || locked} aria-pressed={a.result === code} onClick={() => { if (a.result !== code) commit(code) }}>{label(codes, 'selectionResult', code)}</button>)}
      {notified && <small className="fx-small">{md(a.notifiedAt)} 알림 보냄</small>}</span>
  </div>
}

function SelectTab({ data, codes, mutate, toMatch }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState('')
  const { counts } = data
  const matched = data.applicants.filter((a) => a.status === 'MATCHED' && a.matchedJob)
  const pending = matched.filter((a) => !a.notifiedAt)
  const waitN = pending.filter((a) => a.result === 'WAIT').length
  const failed = matched.filter((a) => a.result === 'FAIL')

  const save = async (a, body) => {
    setBusy(a.applicationId); setError(null); setDone('')
    try { mutate(await setSelection(a.applicationId, body)) } catch (caught) { setError(caught) } finally { setBusy(null) }
  }
  const notify = async () => {
    setBusy('notify'); setError(null); setDone('')
    try {
      const next = await notifyPlacement()
      mutate(next)
      const n = next.applicants.filter((a) => a.notifiedAt && a.notifiedAt === next.notifiedAt).length
      setDone(`결과를 학생 ${n}명에게 알렸어요. 합격한 학생은 타임라인이 '협약 · 보험'으로 넘어가요.`)
    } catch (caught) { setError(caught) } finally { setBusy(null) }
  }

  if (!data.confirmedAt) {
    return <Empty title="매칭을 확정하면 면접 · 선발 결과를 넣을 수 있어요" action={<button type="button" className="fx-btn primary" onClick={toMatch}>매칭 탭으로</button>}>기관이 매칭된 학생을 면접해 뽑아요. 기관이 메일 · 전화로 알려 준 일정과 결과를 여기서 넣어요.</Empty>
  }

  return <>
    <section className="metrics c4">{[['매칭된 학생', `${counts.matched}명`], ['면접 일정 받음', `${counts.interviewed}명`], ['합격', `${counts.pass}명`], ['불합격', `${counts.fail}명`]].map(([name, value]) => <div key={name}><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard">
      <div className="fx-stack">
        {data.notifiedAt && <div className="cm-done"><span>✓ {fmtDateTime(data.notifiedAt)} 결과를 알렸어요. 합격한 학생은 타임라인이 '협약 · 보험'으로 넘어가요.</span><Link className="v2-link" to="/center/close">마무리 →</Link></div>}
        <section className="fx-table">
          <div className="fx-thead cs-cols"><span>학생</span><span>매칭된 직무</span><span>면접 일정</span><span>결과</span></div>
          {matched.map((a) => <SelectionRow key={`${a.applicationId}-${a.interview?.at}-${a.interview?.mode}-${a.result}-${a.notifiedAt}`} a={a} codes={codes} locked={Boolean(busy) && busy !== a.applicationId} saving={busy === a.applicationId} save={save} />)}
        </section>
      </div>
      <aside className="fx-stack">
        <section className="fx-card tight"><h3 className="fx-h3">기관 결과 받기</h3>
          <p className="fx-small">기관 계정이 없어서, 기관이 메일 · 전화로 알려 준 일정과 결과를 센터가 넣어요. 결과는 알림을 보내야 학생에게 보여요. 알린 뒤에는 바꿀 수 없어요.</p>
          <button type="button" className={`fx-btn sm ${pending.length === 0 ? 'dark' : 'primary'}`} style={{ marginTop: 10 }} disabled={pending.length === 0 || Boolean(busy)} onClick={notify}>{pending.length === 0 ? '✓ 학생에게 알림 보냄' : busy === 'notify' ? '알리는 중…' : `결과를 학생 ${pending.length}명에게 알림`}</button>
          {pending.length > 0 && waitN > 0 && !error && <p className="cv2-hint">결과가 '대기'인 학생이 {waitN}명 있어요. 모두 합격 · 불합격을 넣어야 알릴 수 있어요.</p>}
          <ErrorLine error={error} />
          {done && <p className="cv2-ok" role="status">{done}</p>}
        </section>
        <section className="fx-card tight"><h3 className="fx-h3">불합격 학생</h3>
          <p className="fx-small">2026-2는 2차 모집이 없어요. 불합격 학생에게는 진로취업상담과 다음 학기 모집 일정을 안내해요.</p>
          {failed.map((a) => <div key={a.applicationId} className="c-line"><span>{a.student?.nameKo}<VirtualTag show={a.virtual} /><small>{a.matchedJob?.institution?.name} · {a.matchedJob?.title}</small></span><span className="badge gray">{a.notifiedAt ? '알림 보냄' : '알림 전'}</span></div>)}
        </section>
      </aside>
    </div>
  </>
}
