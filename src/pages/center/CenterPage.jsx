import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { advanceCenterDemo, getCenterBoard } from '../../api/center'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, SidePanel } from '../../components/Shell'
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

const demoSteps=[['RECEIVED','신청 접수'],['MATCHED','매칭'],['SELECTED','선발'],['CLOSING','마무리']]
const demoErrorMessage=(error)=>error.code==='DEMO_ONLY'?'체험 센터 계정에서만 시연 단계를 진행할 수 있어요.':error.code==='NETWORK'?'서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.':error.message||'시연 단계를 진행하지 못했어요.'

// 시연 단계 진행(POST /api/center/demo/advance). 가상 데이터를 고른 단계까지 옮기고 현황판을 다시 부른다
function DemoAdvanceCard({ onAdvanced }) {
  const [pending,setPending]=useState(null)
  const [result,setResult]=useState(null)
  const advance=async(to,name)=>{
    setPending(to);setResult(null)
    try{const data=await advanceCenterDemo(to);setResult({ok:true,text:`${name} 단계로 옮겼어요 · ${data.changed??0}건 바뀜`});onAdvanced()}
    catch(error){setResult({ok:false,text:demoErrorMessage(error)})}
    finally{setPending(null)}
  }
  return <div className="card dashboard-demo"><span className="aside-kicker">DEMO</span><h3>시연 단계 진행</h3><p>가상 데이터를 고른 단계까지 진행해요. 실제 학생 데이터는 바뀌지 않아요.</p><div className="demo-steps">{demoSteps.map(([to,name])=><button key={to} type="button" disabled={pending!==null} onClick={()=>advance(to,name)}>{pending===to?'진행 중…':name}</button>)}</div>{result&&<p className={result.ok?'demo-result':'demo-result danger'} role="status">{result.text}</p>}</div>
}

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
  // 슬라이더 범위 = 모집 기간. 백엔드가 replay.minDate·maxDate를 빼고 recruitStart·recruitEnd만 주므로 그걸 쓴다(예전 형태·미리보기 목업은 minDate·maxDate 먼저)
  const rangeStart=replay?.minDate??activeRound.recruitStart
  const rangeEnd=replay?.maxDate??activeRound.recruitEnd
  const days=rangeStart&&rangeEnd?daysBetween(rangeStart,rangeEnd):[]
  const [picked,setPicked]=useState(null)
  const asOf=picked??replay?.defaultAsOf
  const index=Math.max(0,days.indexOf(asOf))
  // 슬라이더 날짜가 바뀔 때마다 그 날 기준으로 다시 부른다. 그동안 이전 날짜 결과를 그대로 보여 준다(useRequest)
  const loadBoard=useCallback((signal)=>getCenterBoard(asOf,signal),[asOf])
  // 센터 전용 토큰으로 부른다(없으면 센터 체험 계정을 자동으로 만든다). 원래 로그인 상태와 상관없이 들어올 수 있다
  const board=useRequest(loadBoard,Boolean(!previewMode&&asOf))
  const [alertsOpen,setAlertsOpen]=useState(false)

  const boardData=previewMode?createCenterPreviewBoard(asOf):board.data
  const eyebrow=`${activeRound.termCode} ${activeRound.programName} · ${activeRound.roundNo}차 모집 ${formatDay(activeRound.recruitStart)}~${formatDay(activeRound.recruitEnd)}`
  const slider=<label className="date-slider"><span><b>{formatDay(asOf)}</b> 기준{!previewMode&&board.loading&&board.data?' · 바꾸는 중…':''}</span><input type="range" min="0" max={days.length-1} value={index} onChange={event=>setPicked(days[Number(event.target.value)])}/><small>{formatDay(rangeStart)}부터 {formatDay(rangeEnd)}까지 날짜별 흐름</small></label>
  const header=<><Link className="center-fixed-back" to="/">← 뒤로가기</Link><div className="demo-banner"><span>DEMO</span> 시연용 가상 데이터 · 실제 학생 지원 현황이 아닙니다{previewMode&&<b>읽기 전용 미리보기</b>}</div><div className="center-hero"><div><PageTitle eyebrow={eyebrow} title="모집 현황을 한눈에 살펴보세요"/><p>직무별 모집 상태와 조회 흐름을 개인정보 없이 확인합니다.</p></div>{slider}</div></>
  if(!boardData)return <main className="center-page">{header}<div className="center-state"><BoardMessage board={board}/></div></main>

  const {summary,rows,alerts}=boardData
  const riskCounts=rows.flatMap(row=>row.risks).reduce((counts,risk)=>({...counts,[risk.label]:(counts[risk.label]??0)+1}),{})
  // 백엔드가 관심(담은 수)을 더는 주지 않는다(ADR-0036). 요약은 직무·정원·마감 3개
  const metrics=[['직무',`${summary.jobs}개`],['전체 모집 정원',`${summary.seats}명`],['마감된 직무',`${summary.closedJobs}개`]]
  // 새 응답은 rows[].closed·closing·views, 미리보기 목업은 예전 rows[].signal — 둘 다 읽는다
  const isClosed=(row)=>row.closed??row.signal?.status==='CLOSED'
  const closingOf=(row)=>row.closing??row.signal??{}

  return <main className="center-page">{header}
    <section className="metrics" style={{gridTemplateColumns:`repeat(${metrics.length},1fr)`}}>{metrics.map(([name,value],metricIndex)=><div key={name}><span className="metric-number">0{metricIndex+1}</span><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard"><section className="card center-table"><div className="list-header"><div><span>LIVE OVERVIEW</span><b>직무별 모집 신호</b></div><small>학생 개인 정보는 표시하지 않습니다{boardData.signalSource&&` · ${label('signalSource',boardData.signalSource)}`}</small></div>
      <div className="center-table-columns"><span>직무·기관</span><span>모집 정원</span><span>상태</span><span>관심</span></div>{rows.map(row=><details key={row.jobId}><summary><span><b>{row.title}</b><small>{row.institution.name}{row.views!=null&&` · 조회 ${row.views.toLocaleString('ko-KR')}`}</small></span><span>정원 {row.headcount}명</span><Badge tone={isClosed(row)?'gray':'green'}>{isClosed(row)?'마감':'모집 중'}</Badge>{/* 관심 열: 백엔드가 관심을 빼서 값이 없다. 어떻게 쓸지 정해지면 바꾼다 */}<span>{row.signal?.interest!=null?<><b>{row.signal.interest}</b>명</>:'–'}</span></summary>
        <div>적격 학생 풀 {row.eligiblePool}명{closingOf(row).closesOn&&` · ${formatDay(dayBefore(closingOf(row).closesOn))} 마감(${label('closeReason',closingOf(row).closeReason)}${closingOf(row).closesOnIsVirtual?', 가상':''})`}{row.alertCount>0&&` · 검토 알림 ${row.alertCount}건`}{row.views!=null&&` · 조회 ${row.views.toLocaleString('ko-KR')}회`}
          {row.risks.length>0&&<div>{row.risks.map(risk=><Badge key={risk.code} tone="orange">{risk.label}{risk.detail?` · ${risk.detail}`:''}</Badge>)}</div>}
          <Link className="link-button" to={`/jobs/${row.jobId}`}>직무 상세 →</Link></div></details>)}
    </section>
    <aside><div className="card dashboard-note"><span className="aside-kicker">HOW TO READ</span><h3>현황판 보는 법</h3><p>모집기간 중 하루를 기준일로 골라 그날의 모집 상태를 봐요. 슬라이더로 기준일을 바꿔 보세요. 조회수는 학생이 직무 상세를 연 실제 횟수예요.</p><ul><li>모집 중 · 마감: 기준일에 지원할 수 있는지</li><li>적격 학생 풀: 선호 전공 학과의 재학생 수</li><li>줄을 누르면 위험 신호와 마감일을 볼 수 있어요</li></ul></div>
      <div className="card dashboard-alert"><h3>확인이 필요한 직무</h3>{Object.keys(riskCounts).length?<ul className="risk-list">{Object.entries(riskCounts).map(([name,count])=><li key={name}>{name} {count}개</li>)}</ul>:<p>위험 신호가 있는 직무가 없어요.</p>}{alerts.length>0&&<button className="link-button" onClick={()=>setAlertsOpen(true)}>문서 검토 알림 {alerts.length}건 보기 →</button>}</div>
      {!previewMode&&<DemoAdvanceCard onAdvanced={board.reload}/>}</aside></div>
    {alertsOpen&&<SidePanel className="center-alert-panel" title={`문서 검토 알림 ${alerts.length}건`} close={()=>setAlertsOpen(false)}>{alerts.map(alert=><div className="alert-item" key={alert.id}><Badge tone="orange">{label('alertKind',alert.kind)}</Badge><b>{alert.institution.name}</b><p>{alert.description}</p>{alert.quoteA&&<blockquote>“{alert.quoteA}”</blockquote>}{alert.pageA&&<p className="source">{alert.pageA}쪽{alert.pageB?` · ${alert.pageB}쪽`:''}</p>}{alert.quoteB&&<blockquote>“{alert.quoteB}”</blockquote>}</div>)}<p className="notice">AI가 운영계획서를 읽다 찾은 불일치예요. 사람이 확인해야 판정에 반영돼요.</p></SidePanel>}
  </main>
}
