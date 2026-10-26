import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getCenterBoard } from '../../api/center'
import { getCurrentRound, label } from '../../api/reference'
import { SidePanel } from '../../components/Shell'
import { ErrorBox, Loading } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate } from '../../lib/format'
import { AlertItem, CenterDemoBanner, dayBefore, useDemoReload } from './centerKit'
import './CenterPage.css'
import './CenterV2.css'

const RISK_ORDER = ['NARROW_POOL', 'PORTFOLIO_REQUIRED', 'CERTIFICATE_REQUIRED', 'WEEKEND', 'DOC_ALERT']
const FIRST_ROWS = 12
const FIRST_DEMAND = 6
const num = (n) => Number(n ?? 0).toLocaleString('ko-KR')

// 그 직무에 걸린 알림 + 기관 전체 알림(현황판 alertCount와 같은 범위)
const alertsOf = (alerts, row) => alerts.filter((alert) => alert.jobId === row.jobId || (alert.jobId == null && alert.institution?.id === row.institution?.id))

function closingText(row, codes) {
  const { closesOn, closeReason, closesOnIsVirtual } = row.closing ?? {}
  if (!closesOn) return null
  const reason = [closeReason ? label(codes, 'closeReason', closeReason) : null, closesOnIsVirtual ? '가상' : null].filter(Boolean).join(', ')
  return `${fmtDate(dayBefore(closesOn))} 마감${reason ? `(${reason})` : ''}`
}

function JobRow({ row, alerts, codes, open }) {
  const rowAlerts = alertsOf(alerts, row)
  const closing = closingText(row, codes)
  return <details open={open}>
    <summary>
      <span><b title={row.title}>{row.title}</b><small>{row.institution?.name} · 조회 {num(row.views)}</small></span>
      <span>정원 {row.headcount}명</span>
      <span><span className={`badge ${row.closed ? 'gray' : 'green'}`}>{row.closed ? '마감' : '모집 중'}</span></span>
      <span><b>{row.risks.length}</b>건</span>
    </summary>
    <div>
      {[`적격 학생 풀 ${num(row.eligiblePool)}명`, closing, row.alertCount > 0 ? `검토 알림 ${row.alertCount}건` : null].filter(Boolean).join(' · ')}
      {row.risks.length > 0 && <div>{row.risks.map((risk) => <span key={risk.code} className="badge orange">{label(codes, 'risk', risk.code) || risk.label}{risk.detail ? ` · ${risk.detail}` : ''}</span>)}</div>}
      {rowAlerts.length > 0 && <div className="cv2-row-alerts">{rowAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} codes={codes} jobTitle={row.title} />)}</div>}
      <Link className="link-button" to={`/jobs/${row.jobId}`}>직무 상세 →</Link>
    </div>
  </details>
}

function TodoCard({ todo }) {
  const line = (text, n, to) => <div className="v2-demand-row todo-row"><b>{text}</b>{n > 0 ? <Link className="v2-link" to={to}>{n}건 →</Link> : <span className="v2-muted">0건</span>}</div>
  return <div className="card v2-demand">
    <span className="aside-kicker">TODAY</span>
    <h3>처리할 것</h3>
    {line('지원서 · 새로 들어옴', todo.newApplications, '/center/inbox?status=SUBMITTED')}
    {line('지원서 · 보완 요청 중', todo.fixRequested, '/center/inbox?status=FIX_REQUESTED')}
    <div className="v2-demand-row todo-row"><b>상담 · 확정 대기</b>{todo.counselPending == null ? <span className="v2-muted">상담 기능 준비 중</span> : <span>{todo.counselPending}건</span>}</div>
  </div>
}

function DemandCard({ demand }) {
  const [all, setAll] = useState(false)
  const rows = demand?.rows ?? []
  const max = Math.max(1, ...rows.map((row) => row.students))
  const shown = all ? rows : rows.slice(0, FIRST_DEMAND)
  return <div className="card v2-demand">
    <span className="aside-kicker">직무 탐색 집계</span>
    <h3>학생이 찾는 직무 vs 이번 회차 공고</h3>
    <p className="v2-muted" style={{ margin: 0 }}>직무 탐색 1~3위에 든 NCS 직무 · 탐색한 학생 {num(demand?.explorers)}명 기준</p>
    {!demand?.explorers && <p className="v2-muted" style={{ margin: '8px 0 0' }}>아직 직무 탐색을 한 학생이 없어요. 같은 브라우저의 체험 학생이 직무 탐색을 하면 여기에 모여요.</p>}
    <div className="v2-demand-head"><span>NCS 직무</span><span>찾는 학생</span><span>공고(정원)</span></div>
    {shown.map((row) => <div className="v2-demand-row" key={row.ncsCode}>
      <b>{row.ncsName}{demand?.explorers > 0 && <i className="cv2-bar" aria-hidden="true"><i style={{ width: `${(row.students / max) * 100}%` }} /></i>}</b>
      <span>{row.students}명</span>
      <span>{row.jobs}곳({row.seats})</span>
    </div>)}
    {rows.length > FIRST_DEMAND && <button type="button" className="link-button" onClick={() => setAll((v) => !v)}>{all ? '접기' : `전체 ${rows.length}개 보기 →`}</button>}
    <div className="fx-callout"><b>섭외 공백은 아직 못 잡아요</b>탐색은 이번 회차 공고 안에서만 골라서, 공고가 없는 직무는 이 표에 나오지 않아요. 찾는 학생에 비해 공고가 적은 직무는 다음 학기 섭외 때 참고해요.</div>
  </div>
}

export function CenterBoardPage() {
  const codes = useCodes()
  const board = useRequest(getCenterBoard)
  const round = useRequest(getCurrentRound)
  useDemoReload(board.reload)
  const [risk, setRisk] = useState(null)
  const [all, setAll] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)

  const r = round.data
  const kicker = r ? `${r.termCode} ${r.programName} · ${r.roundNo}차 모집 ${fmtDate(r.recruitStart)}~${fmtDate(r.recruitEnd)}${board.data ? ` · 기준일 ${fmtDate(board.data.asOf)}` : ''}` : '현장실습지원센터 현황판'
  const head = <>
    <CenterDemoBanner note="직무 · 조건 · 검토 알림은 2026-2 실제 자료예요" />
    <div className="center-hero"><div><header className="page-title"><span>{kicker}</span><h1>이번 회차 직무와 처리할 일을 살펴보세요</h1></header><p>직무별 정원 · 조건 위험 · 문서 검토와, 학생이 탐색으로 찾는 직무를 개인정보 없이 보여 줘요. 관심(찜)은 지원이 아니라서 세지 않아요.</p></div></div>
  </>

  if (!board.data) {
    return <main className="center-page cv2 cv2-board">{head}
      {board.error ? <ErrorBox error={board.error} fallback="현황판을 불러오지 못했어요." retry={board.reload} /> : <Loading text="현황판을 불러오는 중…" note="서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요." />}
    </main>
  }

  const { summary, rows, alerts, todo, demand } = board.data
  const riskCount = (code) => rows.filter((row) => row.risks.some((item) => item.code === code)).length
  const filtered = risk ? rows.filter((row) => row.risks.some((item) => item.code === risk)) : rows
  const shown = all || risk ? filtered : filtered.slice(0, FIRST_ROWS)
  const metrics = [['직무', `${summary.jobs}개`], ['전체 모집 정원', `${summary.seats}명`], ['대상 학과가 좁은 직무', `${riskCount('NARROW_POOL')}개`], ['문서 검토 알림', `${alerts.length}건`], ['마감된 직무', `${summary.closedJobs}개`]]
  const titleOf = (jobId) => rows.find((row) => row.jobId === jobId)?.title

  return <main className="center-page cv2 cv2-board">{head}
    {board.error && <ErrorBox error={board.error} fallback="다시 불러오지 못했어요." retry={board.reload} />}
    <section className="metrics is-five">{metrics.map(([name, value], index) => <div key={name}><span className="metric-number">0{index + 1}</span><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard">
      <section className="card center-table">
        <div className="list-header"><div><span>JOBS · {board.data.round?.termCode}</span><b>직무별 조건과 확인할 것</b></div>
          {risk ? <button type="button" className="fx-chip on" onClick={() => setRisk(null)}>{label(codes, 'risk', risk)} {filtered.length}개 ✕</button> : <small>학생 개인 정보는 표시하지 않습니다{board.loading ? ' · 다시 불러오는 중…' : ''}</small>}
        </div>
        <div className="center-table-columns"><span>직무·기관</span><span>모집 정원</span><span>상태</span><span>확인할 것</span></div>
        {shown.map((row, index) => <JobRow key={row.jobId} row={row} alerts={alerts} codes={codes} open={index === 0 && !risk} />)}
        {!risk && filtered.length > FIRST_ROWS && <button type="button" className="v2-more" onClick={() => setAll((v) => !v)}>{all ? '접기' : `외 ${filtered.length - FIRST_ROWS}개 직무 더 보기`}</button>}
      </section>
      <aside>
        <TodoCard todo={todo} />
        <DemandCard demand={demand} />
        <div className="card dashboard-alert"><h3>확인이 필요한 직무</h3>
          <ul className="risk-list">{RISK_ORDER.map((code) => [code, riskCount(code)]).filter(([, n]) => n > 0).map(([code, n]) => <li key={code}><button type="button" className={risk === code ? 'on' : ''} onClick={() => setRisk(risk === code ? null : code)}>{label(codes, 'risk', code)} {n}개</button></li>)}</ul>
          {alerts.length > 0 && <button type="button" className="link-button" onClick={() => setAlertsOpen(true)}>문서 검토 알림 {alerts.length}건 보기 →</button>}
        </div>
        <div className="card dashboard-note"><span className="aside-kicker">HOW TO READ</span><h3>현황판 보는 법</h3>
          <p>관심(찜) 수는 지원이 아니라서 보여 주지 않아요. 들어온 지원서는 접수함에서 처리해요.</p>
          <ul><li>모집 중 · 마감: 기준일({fmtDate(board.data.asOf)})에 지원할 수 있는지</li><li>적격 학생 풀: 선호 전공 학과의 재학생 수</li><li>위 항목을 누르면 그 직무만 모아 봐요</li><li>줄을 누르면 위험 요인과 검토 알림 원문(문서명 · 쪽)을 볼 수 있어요</li></ul>
        </div>
      </aside>
    </div>
    {alertsOpen && <SidePanel className="cv2-alert-panel" title={`문서 검토 알림 ${alerts.length}건`} close={() => setAlertsOpen(false)}>
      <p className="v2-muted">AI가 운영계획서와 참여기관 리스트를 읽다 찾은 불일치예요. 사람이 확인해야 판정에 반영돼요.</p>
      {alerts.map((alert) => <AlertItem key={alert.id} alert={alert} codes={codes} jobTitle={titleOf(alert.jobId)} />)}
    </SidePanel>}
  </main>
}
