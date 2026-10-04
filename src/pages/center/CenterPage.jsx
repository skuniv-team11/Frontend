import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCenterBoard } from '../../api/center'
import { getToken } from '../../api/client'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, SidePanel } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'

// 'YYYY-MM-DD'를 날짜 하나씩 늘려 가며 목록으로 만든다(시간대 영향 없게 UTC로 센다)
const daysBetween = (from, to) => {
  const days = []
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) days.push(new Date(time).toISOString().slice(0, 10))
  return days
}
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

function BoardMessage({ board }) {
  if (!getToken()) return <p className="notice">센터 담당자로 들어오면 현황판을 볼 수 있어요. <Link className="link-button" to="/">시작 화면에서 [센터 담당자로 보기] →</Link></p>
  if (board.error?.code === 'FORBIDDEN_ROLE') return <p className="notice">현황판은 센터 담당자 계정에서만 볼 수 있어요.</p>
  if (board.error?.status === 401) return <p className="notice">로그인 정보가 없거나 만료됐어요. <Link className="link-button" to="/">시작 화면으로 →</Link></p>
  if (board.error?.code === 'AS_OF_OUT_OF_RANGE') return <p className="notice danger">{board.error.message}</p>
  if (board.error) return <p className="notice danger">현황판을 불러오지 못했어요. <button className="link-button" onClick={board.reload}>다시 불러오기</button></p>
  return <p className="notice">현황판을 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>
}

// 시연 배너(가상 데이터 표시)는 응답과 상관없이 늘 둔다(AGENTS.md — 시연 모드에서 빼지 않는다).
// 모집 상태는 모집 중 · 마감 두 가지만, 지원 의사가 정원보다 많아도 '몰림' 표시·경고는 하지 않는다(ADR-0015). 숫자는 그대로 보여 준다.
export function CenterPage(){
  const round=useRequest(getCurrentRound)
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  const replay=round.data?.replay
  const days=replay?daysBetween(replay.minDate,replay.maxDate):[]
  const [picked,setPicked]=useState(null)
  const asOf=picked??replay?.defaultAsOf
  const index=Math.max(0,days.indexOf(asOf))
  // 슬라이더 날짜가 바뀔 때마다 그 날 기준으로 다시 부른다. 그동안 이전 날짜 결과를 그대로 보여 준다(useRequest)
  const loadBoard=useCallback((signal)=>getCenterBoard(asOf,signal),[asOf])
  const board=useRequest(loadBoard,Boolean(asOf&&getToken()))
  const [alertsOpen,setAlertsOpen]=useState(false)

  const eyebrow=round.data?`${round.data.termCode} ${round.data.programName} · ${round.data.roundNo}차 모집 ${formatDay(round.data.recruitStart)}~${formatDay(round.data.recruitEnd)}`:'현재 모집 회차'
  const slider=round.loading?<span className="date-slider">기준일 불러오는 중…</span>:round.error?<span className="date-slider">기준일을 불러오지 못했어요</span>:<label className="date-slider">{formatDay(asOf)} 기준{board.loading&&board.data?' · 바꾸는 중…':''}<input type="range" min="0" max={days.length-1} value={index} onChange={event=>setPicked(days[Number(event.target.value)])}/><small>지난 모집 기간({formatDay(replay.minDate)}~{formatDay(replay.maxDate)})을 날짜별로 다시 보여 줘요</small></label>
  const header=<><div className="demo-banner">시연용 가상 데이터 · 실제 학생 지원 현황이 아닙니다</div><div className="space-between"><PageTitle eyebrow={eyebrow} title="모집 중 현황판"/>{slider}</div></>
  if(!board.data)return <main className="center-page">{header}<BoardMessage board={board}/></main>

  const {summary,rows,alerts}=board.data
  const riskCounts=rows.flatMap(row=>row.risks).reduce((counts,risk)=>({...counts,[risk.label]:(counts[risk.label]??0)+1}),{})
  const metrics=[['직무',`${summary.jobs}개`],['전체 모집 정원',`${summary.seats}명`],['지원 의사 합',`${summary.intentTotal}명`],['지원 의사 0인 직무',`${summary.zeroSignalJobs}개`],['마감된 직무',`${summary.closedJobs}개`]]

  return <main className="center-page">{header}
    <section className="metrics is-five">{metrics.map(([name,value])=><div key={name}><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard"><section className="card center-table"><div className="list-header"><b>직무별 모집 신호 ({rows.length})</b><small>학생 개인 정보는 표시하지 않습니다 · {label('signalSource',board.data.signalSource)}</small></div>
      {rows.map(row=><details key={row.jobId}><summary><span><b>{row.title}</b><small>{row.institution.name}</small></span><span>정원 {row.headcount}명</span><Badge tone={row.signal.status==='OPEN'?'green':'gray'}>{label('signalStatus',row.signal.status)}</Badge><span>지원 의사 {row.signal.intent}명</span></summary>
        <div>관심 {row.signal.interest}명 · 적격 학생 풀 {row.eligiblePool}명{row.signal.closesOn&&` · ${formatDay(dayBefore(row.signal.closesOn))} 마감(${label('closeReason',row.signal.closeReason)}${row.signal.closesOnIsVirtual?', 가상':''})`}{row.signal.expectedFullOn&&` · 정원 도달 예상 ${formatDay(row.signal.expectedFullOn)}`}{row.alertCount>0&&` · 검토 알림 ${row.alertCount}건`}
          {row.risks.length>0&&<div>{row.risks.map(risk=><Badge key={risk.code} tone="orange">{risk.label}{risk.detail?` · ${risk.detail}`:''}</Badge>)}</div>}
          <Link className="link-button" to={`/jobs/${row.jobId}`}>직무 상세 →</Link></div></details>)}
    </section>
    <aside><div className="card dashboard-note"><h3>현황판 보는 법</h3><p>모집기간을 날짜별로 다시 재생한 가상 지원 의사·관심 수예요. 슬라이더로 기준일을 바꿔 보세요.</p><ul><li>모집 중 · 마감: 기준일에 지원할 수 있는지</li><li>적격 학생 풀: 선호 전공 학과의 재학생 수</li><li>줄을 누르면 위험 신호와 마감일을 볼 수 있어요</li></ul></div>
      <div className="card dashboard-alert"><h3>확인이 필요한 직무</h3>{Object.keys(riskCounts).length?<ul className="risk-list">{Object.entries(riskCounts).map(([name,count])=><li key={name}>{name} {count}개</li>)}</ul>:<p>위험 신호가 있는 직무가 없어요.</p>}{alerts.length>0&&<button className="link-button" onClick={()=>setAlertsOpen(true)}>문서 검토 알림 {alerts.length}건 보기 →</button>}</div></aside></div>
    {alertsOpen&&<SidePanel title={`문서 검토 알림 ${alerts.length}건`} close={()=>setAlertsOpen(false)}>{alerts.map(alert=><div className="alert-item" key={alert.id}><Badge tone="orange">{label('alertKind',alert.kind)}</Badge><b>{alert.institution.name}</b><p>{alert.description}</p>{alert.quoteA&&<blockquote>“{alert.quoteA}”</blockquote>}{alert.pageA&&<p className="source">{alert.pageA}쪽{alert.pageB?` · ${alert.pageB}쪽`:''}</p>}{alert.quoteB&&<blockquote>“{alert.quoteB}”</blockquote>}</div>)}<p className="notice">AI가 운영계획서를 읽다 찾은 불일치예요. 사람이 확인해야 판정에 반영돼요.</p></SidePanel>}
  </main>
}
