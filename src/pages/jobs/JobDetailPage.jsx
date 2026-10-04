import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getCommute, getJob } from '../../api/jobs'
import { getMyProfile } from '../../api/myInfo'
import { getCodes } from '../../api/reference'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { Badge, SidePanel } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'

const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
const won = (amount) => `${amount.toLocaleString('ko-KR')}원`

// 통근 칸. 출발지는 저장한 프로필의 사는 곳(없거나 센터 계정이면 서경대). 결과는 이 화면 상태로만 들고 저장하지 않는다(AGENTS.md).
function CommuteCard({ jobId, hasCoordinates, label }) {
  const profile = useRequest(getMyProfile, Boolean(getToken()))
  const homeAreaCode = profile.data?.homeAreaCode ?? null
  const loadCommute = useCallback((signal) => getCommute(jobId, homeAreaCode, signal), [jobId, homeAreaCode])
  const commute = useRequest(loadCommute, hasCoordinates && !profile.loading)
  const body = !hasCoordinates ? <p>근무지 주소가 없어 통근 시간을 계산할 수 없어요.</p>
    : profile.loading || commute.loading ? <p role="status">통근 시간을 불러오는 중… 카카오맵 대중교통 기준으로 계산하고 있어요.</p>
    : commute.error ? <p>통근 시간을 불러오지 못했어요. <button className="link-button" onClick={commute.reload}>다시 불러오기</button></p>
    : !commute.data.available ? <p>{commute.data.origin.label}에서 출발 · 카카오맵 대중교통 기준<br/>통근 시간을 불러오지 못했어요({label('commuteUnavailable', commute.data.unavailableReason)}). <button className="link-button" onClick={commute.reload}>다시 불러오기</button></p>
    : <><p><b>{commute.data.origin.label}</b>에서 출발 · {label('commuteProvider', commute.data.provider)} 대중교통 기준{commute.data.origin.type === 'SCHOOL' && ' (사는 곳을 저장하지 않아 서경대에서 출발로 계산했어요)'}</p><div><strong>약 {commute.data.minutes}분</strong><span>환승 {commute.data.transfers}회{commute.data.fareWon != null && ` · 요금 ${commute.data.fareWon.toLocaleString('ko-KR')}원`}</span></div></>
  return <section className="card commute"><h2>통근</h2>{body}<small>통근 결과는 저장하지 않아요.</small></section>
}

function DetailError({ error }) {
  if (error.code === 'JOB_NOT_FOUND') return <p className="notice">없는 직무예요. <Link className="link-button" to="/jobs">직무 찾기로 돌아가기 →</Link></p>
  if (error.status === 401) return <p className="notice">로그인하면 직무 상세를 볼 수 있어요. <Link className="link-button" to="/login">로그인하기 →</Link></p>
  if (error.code === 'NETWORK') return <p className="notice danger">서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
  return <p className="notice danger">직무 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
}

export function JobDetailPage() {
  const {id}=useParams()
  const loadJob=useCallback((signal)=>getJob(id,signal),[id])
  const job=useRequest(loadJob)
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  const [tab,setTab]=useState('reason'); const [source,setSource]=useState(null)

  if(job.loading)return <main className="content two-column"><section><Link className="back" to="/jobs">← 직무 찾기로</Link><p className="notice">직무 정보를 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p></section></main>
  if(job.error)return <main className="content two-column"><section><Link className="back" to="/jobs">← 직무 찾기로</Link><DetailError error={job.error}/></section></main>

  const detail=job.data; const {institution,conditions,requirements,closing}=detail
  const evidenceOf=(fieldKey)=>detail.evidence.find(item=>item.fieldKey===fieldKey)
  const sourceButton=(fieldKey)=>{const found=evidenceOf(fieldKey);return found?<button onClick={()=>setSource(fieldKey)}>원문 {found.page}쪽</button>:<span/>}
  const shownEvidence=source==='all'?detail.evidence:detail.evidence.filter(item=>item.fieldKey===source)

  const requirementRows=[
    ['학년',label('gradeRule',requirements.gradeRule),'gradeRequirement'],
    ['학점',requirements.gpaMin!=null?`평점 ${requirements.gpaMin} 이상`:'조건 없음','gpaRequirement'],
    ['선호 전공',requirements.majorOpen?'전공 무관':`${requirements.majorText}${requirements.majorAliases.length?` → ${requirements.majorAliases.flatMap(alias=>alias.departments.map(department=>department.name)).join(', ')}`:''}`,'majorRequirement'],
    ['포트폴리오',label('requirement',requirements.portfolio),'portfolio'],
    ['자격증',`${label('requirement',requirements.certificate)}${requirements.certificateText?` · ${requirements.certificateText}`:''}`,'certificate'],
  ]
  const conditionRows=[
    ['실습 과정',label('course',conditions.course)],
    ['실습 유형',label('jobType',conditions.jobType)],
    ['실습 기간',conditions.period?`${conditions.period.start} ~ ${conditions.period.end}`:'미기재'],
    ['실습 시간',`${conditions.workHoursText??'미기재'}${conditions.weeklyHours?` · 주 ${conditions.weeklyHours}시간`:''}`],
    ['실습 요일',(conditions.weekdays??[]).map(day=>label('weekday',day)).join(', ')||'미기재'],
    ['연장 실습',label('overtime',conditions.overtime)],
    ['근로계약',conditions.laborContract?'있음':'없음'],
    ['실습지원비',conditions.stipend?.amount?`${label('stipendBasis',conditions.stipend.basis)} ${won(conditions.stipend.amount)}${conditions.stipend.minWageRatio!=null?` (최저임금 대비 ${conditions.stipend.minWageRatio}%)`:''}`:'미기재'],
    ['복리후생',(conditions.benefits??[]).map(benefit=>label('benefit',benefit)).join(', ')||'없음'],
    ['모집 인원',`${conditions.headcount}명`],
  ]
  const institutionRows=[
    ['기관명',institution.name],
    ['규모',`${label('size',institution.size)} · ${label('listing',institution.listing)}`],
    ['업태',institution.businessType??'미기재'],
    ['종목',institution.businessItem??'미기재'],
    ['주소',institution.address??'미기재'],
    ['사업자 상태',`${label('ntsStatus',institution.ntsStatus)}${institution.ntsCheckedOn?` (${institution.ntsCheckedOn} 확인)`:''}`],
  ]

  return <main className="content two-column"><section><Link className="back" to="/jobs">← 직무 찾기로</Link><PageTitle eyebrow={`${institution.name} · ${detail.team}`} title={detail.title}/>
    <div className="metadata"><Badge tone="blue">{label('jobType',conditions.jobType)}</Badge><Badge>{label('course',conditions.course)}</Badge>{closing.closesOn&&<Badge tone="orange">{formatDay(dayBefore(closing.closesOn))} 마감{closing.closesOnIsVirtual?'(가상)':''}</Badge>}<span>{detail.workplace.address??institution.address}</span><span>{conditions.headcount}명 모집</span>{detail.alerts.length>0&&<Badge tone="orange">문서 검토 {detail.alerts.length}건</Badge>}</div>
    <div className="detail-tabs tabs"><button className={tab==='reason'?'active':''} onClick={()=>setTab('reason')}>판정 이유</button><button className={tab==='work'?'active':''} onClick={()=>setTab('work')}>하는 일 · 기관</button></div>
    {tab==='reason'?<><section className="card reason-card"><h2>기관이 정한 지원 조건</h2>{requirementRows.map(([title,text,fieldKey])=><div className="reason-row" key={title}><b>{title}</b><span>{text}</span>{sourceButton(fieldKey)}</div>)}<p className="notice">내 프로필과 비교한 결과(충족 · 확인 필요)는 직무 찾기의 판정과 함께 보여 줄 예정이에요.</p><button className="link-button" onClick={()=>setSource('all')}>AI가 읽은 값과 근거 모두 보기({detail.evidence.length}) →</button></section><CommuteCard jobId={detail.id} hasCoordinates={detail.workplace.hasCoordinates} label={label}/></>
    :<section className="card work-card"><h2>이런 일을 해요</h2><p>{detail.overview}</p><h3>교육 목표</h3><p>{detail.educationGoal}</p><h3>요구 역량</h3><p>{detail.competencies}</p>{detail.weeklyPlan.length>0&&<><h3>주차별 계획</h3><ol>{detail.weeklyPlan.map(week=><li key={week.seq}><b>{week.weeksLabel}</b> {week.content}</li>)}</ol></>}<h2>실습 조건</h2><dl className="detail-dl">{conditionRows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl><h2>기관 정보</h2><dl className="detail-dl">{institutionRows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>{detail.seniorNotes.length>0&&<><h2>선배 수기</h2>{detail.seniorNotes.map((note,index)=><div className="senior-note" key={`${note.termCode}-${index}`}><b>{note.termCode} · {note.teamText}</b><ul>{note.activities.map(activity=><li key={activity}>{activity}</li>)}</ul><p className="source">{note.documentTitle} · {note.page}쪽</p></div>)}</>}</section>}
  </section><ActionCard action={<Link className="button primary full" to="/plan">담고 내 지망에서 순서 정하기</Link>}><h3>내 지망에 담아두기</h3><p>담은 뒤 1~3지망 순서를 정할 수 있어요.</p></ActionCard>
  {source&&<SidePanel title="출처 · AI가 읽은 값" close={()=>setSource(null)}>{shownEvidence.map(item=><div key={item.fieldKey}><h3>{item.label}</h3>{item.rawValue&&<p>{item.rawValue}</p>}<blockquote>“{item.quote}”</blockquote><p className="source">{item.documentTitle} · {item.page}쪽</p></div>)}<p className="notice">AI가 읽은 값은 원문과 다를 수 있어요. 최종 지원 전 반드시 확인하세요.</p></SidePanel>}</main>
}
