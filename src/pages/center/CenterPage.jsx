import { useState } from 'react'
import { getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'
import { jobs } from '../../mock/jobs'

// 'YYYY-MM-DD'를 날짜 하나씩 늘려 가며 목록으로 만든다(시간대 영향 없게 UTC로 센다)
const daysBetween = (from, to) => {
  const days = []
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86400000) days.push(new Date(time).toISOString().slice(0, 10))
  return days
}
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`

// 시연 배너(가상 데이터 표시)는 응답과 상관없이 늘 둔다(AGENTS.md — 시연 모드에서 빼지 않는다).
// 요약 숫자·직무 표는 아직 목업이다. GET /api/center/board?asOf= 연동 때 asOf를 넘겨 바꾼다.
export function CenterPage(){
  const round=useRequest(getCurrentRound)
  const replay=round.data?.replay
  const days=replay?daysBetween(replay.minDate,replay.maxDate):[]
  const [picked,setPicked]=useState(null)
  const asOf=picked??replay?.defaultAsOf
  const index=Math.max(0,days.indexOf(asOf))
  const dayOfMonth=asOf?Number(asOf.slice(8,10)):18
  const eyebrow=round.data?`${round.data.termCode} ${round.data.programName} · ${round.data.roundNo}차 모집 ${formatDay(round.data.recruitStart)}~${formatDay(round.data.recruitEnd)}`:'현재 모집 회차'
  const slider=round.loading?<span className="date-slider">기준일 불러오는 중…</span>:round.error?<span className="date-slider">기준일을 불러오지 못했어요</span>:<label className="date-slider">{formatDay(asOf)} 기준<input type="range" min="0" max={days.length-1} value={index} onChange={event=>setPicked(days[Number(event.target.value)])}/><small>지난 모집 기간({formatDay(replay.minDate)}~{formatDay(replay.maxDate)})을 날짜별로 다시 보여 줘요</small></label>
  return <main className="center-page"><div className="demo-banner">시연용 가상 데이터 · 실제 학생 지원 현황이 아닙니다</div><div className="space-between"><PageTitle eyebrow={eyebrow} title="모집 중 현황판"/>{slider}</div><section className="metrics">{[['모집 중 직무','18'],['전체 모집 정원','42'],['지망 표시 학생',dayOfMonth<23?'31':'38'],['자리 여유 직무',dayOfMonth<23?'11':'8']].map(([label,value])=><div key={label}><small>{label}</small><b>{value}</b></div>)}</section><div className="dashboard"><section className="card center-table"><div className="list-header"><b>직무별 모집 신호</b><small>학생 개인 정보는 표시하지 않습니다</small></div>{jobs.concat(jobs.slice(0,2)).map((job,index)=><details key={`${job.id}-${index}`}><summary><span><b>{job.title}</b><small>{job.company}</small></span><span>{job.seats}명 모집</span><Badge tone={index<3?'green':'orange'}>{index<3?'자리 여유':'마감 가까움'}</Badge><span>{index+2}명 표시</span></summary><div>전공 분포: 디자인 계열 {index+1}명 · 경영 계열 1명 <small>익명 집계</small></div></details>)}</section><aside><div className="card dashboard-note"><h3>현황판 보는 법</h3><p>학생이 지망에 담은 수를 익명으로 집계해 모집 지원에 참고합니다.</p><ul><li>자리 여유: 정원 대비 여유 있음</li><li>마감 가까움: 모집 마감 임박</li></ul></div><div className="card dashboard-alert"><h3>확인이 필요한 직무</h3><p>마감일까지 3일 이하인 직무가 4개 있어요.</p></div></aside></div></main>
}
