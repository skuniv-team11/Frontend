import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCenterBoard, getCenterJobViews } from '../../api/center'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, SidePanel } from '../../components/Shell'
import { useJobViews } from '../../hooks/useJobViews'
import { useRequest } from '../../hooks/useRequest'
import { centerPreviewRound, createCenterPreviewBoard } from '../../mock/center'
import './CenterPage.css'

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
  if (board.error?.code === 'RATE_LIMITED') return <p className="notice danger">센터 체험 계정을 너무 많이 만들었어요. 잠시 뒤 다시 시도해 주세요.</p>
  if (board.error?.code === 'FORBIDDEN_ROLE') return <p className="notice">현황판은 센터 담당자 계정에서만 볼 수 있어요.</p>
  if (board.error?.status === 401) return <p className="notice danger">센터 체험 계정에 들어가지 못했어요. <button className="link-button" onClick={board.reload}>다시 시도</button></p>
  if (board.error?.code === 'AS_OF_OUT_OF_RANGE') return <p className="notice danger">{board.error.message}</p>
  if (board.error) return <p className="notice danger">현황판을 불러오지 못했어요. <button className="link-button" onClick={board.reload}>다시 불러오기</button></p>
  return <p className="notice">현황판을 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>
}

// 시연 배너(가상 데이터 표시)는 응답과 상관없이 늘 둔다(AGENTS.md — 시연 모드에서 빼지 않는다).
// 모집 상태는 모집 중 · 마감 두 가지만, 관심이 정원보다 많아도 '몰림' 표시·경고는 하지 않는다(ADR-0015). 숫자는 그대로 보여 준다.
export function CenterPage(){
  const [searchParams]=useSearchParams()
  const previewMode=searchParams.get('preview')==='1'
  const round=useRequest(getCurrentRound)
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  const activeRound=round.data??centerPreviewRound
  const replay=activeRound.replay
  const days=replay?daysBetween(replay.minDate,replay.maxDate):[]
  const [picked,setPicked]=useState(null)
  const asOf=picked??replay?.defaultAsOf
  const index=Math.max(0,days.indexOf(asOf))
  // 슬라이더 날짜가 바뀔 때마다 그 날 기준으로 다시 부른다. 그동안 이전 날짜 결과를 그대로 보여 준다(useRequest)
  const loadBoard=useCallback((signal)=>getCenterBoard(asOf,signal),[asOf])
  // 센터 전용 토큰으로 부른다(없으면 센터 체험 계정을 자동으로 만든다). 원래 로그인 상태와 상관없이 들어올 수 있다
  const board=useRequest(loadBoard,Boolean(!previewMode&&asOf))
  const [alertsOpen,setAlertsOpen]=useState(false)
  // 표에 바로 보이는 조회수. 직무 목록은 날짜를 바꿔도 같아서 처음 한 번만 부른다(조회수는 실제 값, 기준일과 상관없음)
  // 미리보기 목업은 실제 직무가 아니라 부르지 않는다
  const jobViews=useJobViews(board.data?.rows.map(row=>row.jobId)??[],getCenterJobViews,!previewMode&&Boolean(board.data))

  const boardData=previewMode?createCenterPreviewBoard(asOf):board.data
  const eyebrow=`${activeRound.termCode} ${activeRound.programName} · ${activeRound.roundNo}차 모집 ${formatDay(activeRound.recruitStart)}~${formatDay(activeRound.recruitEnd)}`
  const slider=<label className="date-slider"><span><b>{formatDay(asOf)}</b> 기준{!previewMode&&board.loading&&board.data?' · 바꾸는 중…':''}</span><input type="range" min="0" max={days.length-1} value={index} onChange={event=>setPicked(days[Number(event.target.value)])}/><small>{formatDay(replay.minDate)}부터 {formatDay(replay.maxDate)}까지 날짜별 흐름</small></label>
  const header=<><Link className="center-fixed-back" to="/">← 뒤로가기</Link><div className="demo-banner"><span>DEMO</span> 시연용 가상 데이터 · 실제 학생 지원 현황이 아닙니다{previewMode&&<b>읽기 전용 미리보기</b>}</div><div className="center-hero"><div><PageTitle eyebrow={eyebrow} title="모집 현황을 한눈에 살펴보세요"/><p>직무별 모집 상태와 학생들의 관심(내 지망에 담은 수) 흐름을 개인정보 없이 확인합니다.</p></div>{slider}</div></>
  if(!boardData)return <main className="center-page">{header}<div className="center-state"><BoardMessage board={board}/></div></main>

  const {summary,rows,alerts}=boardData
  const riskCounts=rows.flatMap(row=>row.risks).reduce((counts,risk)=>({...counts,[risk.label]:(counts[risk.label]??0)+1}),{})
  const metrics=[['직무',`${summary.jobs}개`],['전체 모집 정원',`${summary.seats}명`],['관심 합',`${summary.interestTotal}명`],['관심 0인 직무',`${summary.zeroSignalJobs}개`],['마감된 직무',`${summary.closedJobs}개`]]

  return <main className="center-page">{header}
    <section className="metrics is-five">{metrics.map(([name,value],metricIndex)=><div key={name}><span className="metric-number">0{metricIndex+1}</span><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard"><section className="card center-table"><div className="list-header"><div><span>LIVE OVERVIEW</span><b>직무별 모집 신호</b></div><small>학생 개인 정보는 표시하지 않습니다 · {label('signalSource',boardData.signalSource)}</small></div>
      <div className="center-table-columns"><span>직무·기관</span><span>모집 정원</span><span>상태</span><span>관심</span></div>{rows.map(row=><details key={row.jobId}><summary><span><b>{row.title}</b><small>{row.institution.name}{jobViews.data?.[row.jobId]&&` · 조회 ${jobViews.data[row.jobId].views.toLocaleString('ko-KR')}`}</small></span><span>정원 {row.headcount}명</span><Badge tone={row.signal.status==='OPEN'?'green':'gray'}>{row.signal.status==='OPEN'?'모집 중':'마감'}</Badge><span><b>{row.signal.interest}</b>명</span></summary>
        <div>관심 {row.signal.interest}명(그중 실제 사용자 {row.signal.liveInterest ?? 0}명) · 적격 학생 풀 {row.eligiblePool}명{row.signal.closesOn&&` · ${formatDay(dayBefore(row.signal.closesOn))} 마감(${label('closeReason',row.signal.closeReason)}${row.signal.closesOnIsVirtual?', 가상':''})`}{row.signal.expectedFullOn&&` · 정원 도달 예상 ${formatDay(row.signal.expectedFullOn)}`}{row.alertCount>0&&` · 검토 알림 ${row.alertCount}건`}{jobViews.data?.[row.jobId]&&` · 조회 ${jobViews.data[row.jobId].views.toLocaleString('ko-KR')}회(오늘 ${jobViews.data[row.jobId].todayViews.toLocaleString('ko-KR')}회)`}
          {row.risks.length>0&&<div>{row.risks.map(risk=><Badge key={risk.code} tone="orange">{risk.label}{risk.detail?` · ${risk.detail}`:''}</Badge>)}</div>}
          <Link className="link-button" to={`/jobs/${row.jobId}`}>직무 상세 →</Link></div></details>)}
    </section>
    <aside><div className="card dashboard-note"><span className="aside-kicker">HOW TO READ</span><h3>현황판 보는 법</h3><p>모집기간을 날짜별로 다시 재생한 관심 수(내 지망에 담은 사람 수)예요. 가상 값에 실제 사용자가 담은 수를 더해요. 슬라이더로 기준일을 바꿔 보세요.</p><ul><li>모집 중 · 마감: 기준일에 지원할 수 있는지</li><li>적격 학생 풀: 선호 전공 학과의 재학생 수</li><li>줄을 누르면 위험 신호와 마감일을 볼 수 있어요</li></ul></div>
      <div className="card dashboard-alert"><h3>확인이 필요한 직무</h3>{Object.keys(riskCounts).length?<ul className="risk-list">{Object.entries(riskCounts).map(([name,count])=><li key={name}>{name} {count}개</li>)}</ul>:<p>위험 신호가 있는 직무가 없어요.</p>}{alerts.length>0&&<button className="link-button" onClick={()=>setAlertsOpen(true)}>문서 검토 알림 {alerts.length}건 보기 →</button>}</div></aside></div>
    {alertsOpen&&<SidePanel className="center-alert-panel" title={`문서 검토 알림 ${alerts.length}건`} close={()=>setAlertsOpen(false)}>{alerts.map(alert=><div className="alert-item" key={alert.id}><Badge tone="orange">{label('alertKind',alert.kind)}</Badge><b>{alert.institution.name}</b><p>{alert.description}</p>{alert.quoteA&&<blockquote>“{alert.quoteA}”</blockquote>}{alert.pageA&&<p className="source">{alert.pageA}쪽{alert.pageB?` · ${alert.pageB}쪽`:''}</p>}{alert.quoteB&&<blockquote>“{alert.quoteB}”</blockquote>}</div>)}<p className="notice">AI가 운영계획서를 읽다 찾은 불일치예요. 사람이 확인해야 판정에 반영돼요.</p></SidePanel>}
  </main>
}
