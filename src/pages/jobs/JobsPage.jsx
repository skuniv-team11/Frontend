import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getEligibility, getRecommendationReason, getRecommendations, toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { getCodes, getCurrentRound } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge, Modal, SidePanel } from '../../components/Shell'
import { useRequest } from '../../hooks/useRequest'

const verdictTone = { ELIGIBLE: 'green', NEEDS_CHECK: 'orange', INELIGIBLE: 'gray' }
const resultTone = { MET: 'green', NOT_MET: 'orange', CHECK: 'orange', INFO: 'gray' }
const filters = [['ALL', '전체'], ['ELIGIBLE', '지원 가능'], ['NEEDS_CHECK', '확인 필요'], ['INELIGIBLE', '지원 불가']]
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

const won = (amount) => `${amount.toLocaleString('ko-KR')}원`

// 추천 카드 하나. reasonStatus가 PENDING이면 이유 문장 API를 불러 바꾼다(2~6초). 그동안·실패 때는 규칙 문장(reasonTemplate)을 보여 준다.
function RecommendationCard({ item, profile, label, openCitations }) {
  const loadReason = useCallback((signal) => getRecommendationReason(item.jobId, profile, signal), [item.jobId, profile])
  const reason = useRequest(loadReason, item.reasonStatus === 'PENDING')
  const text = reason.data?.text ?? item.reasonTemplate
  const citations = reason.data?.citations ?? item.citations
  return <article className="recommend-card"><div><Badge tone={verdictTone[item.verdict]}>{label('verdict', item.verdict)}</Badge><Badge>적합도 {label('fit', item.fit)}</Badge></div><small>{item.rank}위 · {item.institution.name}</small><h3><Link to={`/jobs/${item.jobId}`}>{item.title}</Link></h3><p>{label('jobType', item.jobType)}{item.stipend?.amount ? ` · ${label('stipendBasis', item.stipend.basis)} ${won(item.stipend.amount)}` : ''}</p><p>{text}</p>{reason.loading && <small>이유 문장을 다듬는 중…</small>}{citations.length > 0 && <button className="link-button" onClick={() => openCitations({ ...item, reasonTemplate: text, citations })}>근거 보기 →</button>}</article>
}

// 추천 5개. 판정 목록과 따로 불러와서, 늦거나 실패해도 아래 목록은 그대로 보인다.
function RecommendationSection({ recommendations, profile, label, openCitations }) {
  if (recommendations.loading) return <p className="notice">관심 분야와 가까운 직무를 고르는 중…</p>
  if (recommendations.error) return <p className="notice danger">추천을 불러오지 못했어요. 아래 전체 직무에서 골라 보세요.</p>
  const { items, blockedBy } = recommendations.data
  if (!items.length) return <p className="notice">지금 조건으로 추천할 직무가 없어요.{blockedBy.length > 0 && ` ${blockedBy.map(block => `${block.item} 때문에 ${block.count}개`).join(', ')}가 빠졌어요.`}</p>
  return <section className="recommendations">{items.map(item => <RecommendationCard key={item.jobId} item={item} profile={profile} label={label} openCitations={openCitations}/>)}</section>
}

function Blocked({ children }) {
  return <main className="content wide"><PageTitle eyebrow="내 조건으로 찾은 결과" title="지원할 수 있는 직무를 모았어요"/><div className="card form-card">{children}</div></main>
}

export function JobsPage() {
  const loggedIn=Boolean(getToken())
  const profile=useRequest(getMyProfile,loggedIn)
  const loadEligibility=useCallback((signal)=>getEligibility(toProfileBody(profile.data),signal),[profile.data])
  const eligibility=useRequest(loadEligibility,Boolean(profile.data))
  const profileBody=useMemo(()=>profile.data?toProfileBody(profile.data):null,[profile.data])
  const loadRecommendations=useCallback((signal)=>getRecommendations(profileBody,signal),[profileBody])
  const recommendations=useRequest(loadRecommendations,Boolean(profile.data))
  const round=useRequest(getCurrentRound)
  const codes=useRequest(getCodes)
  const label=(group,value)=>codes.data?.[group]?.[value]??value

  const [filter,setFilter]=useState('ALL'); const [reasonJob,setReasonJob]=useState(null); const [citationJob,setCitationJob]=useState(null)
  // 담기는 아직 화면 상태로만 둔다(지망 API 연동 전)
  const [saved,setSaved]=useState([]); const [guide,setGuide]=useState(false)
  const save=(id)=>{if(!saved.includes(id)){setSaved([...saved,id]);if(saved.length===0)setGuide(true)}}

  if(!loggedIn)return <Blocked><p className="notice">로그인하거나 [예시 프로필로 시작]을 누르면 내 조건으로 판정해 드려요.</p><Link className="link-button" to="/login">로그인하기 →</Link></Blocked>
  if(profile.loading)return <Blocked><p className="notice">저장한 프로필을 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p></Blocked>
  if(profile.error?.code==='PROFILE_NOT_FOUND')return <Blocked><p className="notice">판정에 쓸 프로필이 없어요. 프로필을 입력하고 저장하면 지원할 수 있는 직무를 찾아 드려요.</p><Link className="link-button" to="/profile">프로필 입력하기 →</Link></Blocked>
  if(profile.error?.code==='FORBIDDEN_ROLE')return <Blocked><p className="notice">직무 판정은 학생 계정에서만 볼 수 있어요.</p></Blocked>
  if(profile.error?.status===401)return <Blocked><p className="notice">로그인 정보가 없거나 만료됐어요.</p><Link className="link-button" to="/login">다시 로그인하기 →</Link></Blocked>
  if(profile.error)return <Blocked><p className="notice danger">프로필을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p></Blocked>
  if(eligibility.loading)return <Blocked><p className="notice">40개 직무를 내 조건으로 판정하는 중…</p></Blocked>
  if(eligibility.error)return <Blocked><p className="notice danger">{eligibility.error.code==='INVALID_INPUT'?`프로필 값을 확인해 주세요. ${eligibility.error.fields.map(field=>field.reason).join(' · ')}`:'판정 결과를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'}</p><Link className="link-button" to="/profile">프로필 확인하기 →</Link></Blocked>

  const {summary,jobs}=eligibility.data
  const asOf=round.data?.replay?.defaultAsOf
  const isClosed=(job)=>Boolean(job.closing.closesOn&&asOf&&job.closing.closesOn<=asOf)
  const counts={ALL:summary.total,ELIGIBLE:summary.eligible,NEEDS_CHECK:summary.needsCheck,INELIGIBLE:summary.ineligible}
  const shown=filter==='ALL'?jobs:jobs.filter(job=>job.verdict===filter)

  return <main className="content wide"><div className="space-between"><PageTitle eyebrow="내 조건으로 찾은 결과" title="지원할 수 있는 직무를 모았어요" description="판정 이유를 눌러 내 조건과 직무 조건을 비교해 보세요."/><div className="result-summary"><b>추천 {recommendations.data?.items.length??'–'} · 전체 {summary.total}</b><span>지원 가능 {summary.eligible} · 확인 필요 {summary.needsCheck} · 지원 불가 {summary.ineligible}</span></div></div>
    <RecommendationSection recommendations={recommendations} profile={profileBody} label={label} openCitations={setCitationJob}/>
    <section className="card jobs-list"><div className="list-header"><b>전체 직무</b><div className="filter">{filters.map(([key,name])=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{name} {counts[key]}</button>)}</div></div>
      {shown.length===0&&<p className="notice">이 판정에 해당하는 직무가 없어요.</p>}
      {shown.map(job=><div className="job-row" key={job.jobId}><div><Link to={`/jobs/${job.jobId}`}><b>{job.title}</b></Link><small>{job.institution.name} · {job.team}</small></div><div><Badge>{label('majorMatch',job.majorMatch)}</Badge>{job.alertCount>0&&<Badge tone="orange">문서 검토</Badge>}</div><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge><span>{isClosed(job)?<Badge>마감</Badge>:job.closing.closesOn?`${formatDay(dayBefore(job.closing.closesOn))} 마감`:'모집 중'}</span><div><button className="link-button" onClick={()=>setReasonJob(job)}>판정 이유</button> <button className={`save-button ${saved.includes(job.jobId)?'saved':''}`} onClick={()=>save(job.jobId)}>{saved.includes(job.jobId)?'담았어요':'담기'}</button></div></div>)}
    </section>
    {reasonJob&&<SidePanel title="이렇게 판단했어요" close={()=>setReasonJob(null)}><Badge tone={verdictTone[reasonJob.verdict]}>{label('verdict',reasonJob.verdict)}</Badge><h3>{reasonJob.title}</h3><p className="source">{reasonJob.institution.name} · {reasonJob.team}</p>{reasonJob.reasons.map((reason,index)=><div className="reason-row" key={`${reason.layer}-${reason.item}-${index}`}><b>{label('reasonLayer',reason.layer)}<br/>{reason.item}</b><span>{reason.requirement}<br/><small>내 값: {reason.mine}</small></span><Badge tone={resultTone[reason.result]}>{label('reasonResult',reason.result)}</Badge></div>)}<p className="notice">선호 전공은 참고용이라 판정에 넣지 않아요. 원문 근거는 직무 상세에서 볼 수 있어요.</p><Link className="button primary full" to={`/jobs/${reasonJob.jobId}`}>직무 상세 보기</Link></SidePanel>}
    {citationJob&&<SidePanel title="추천 근거" close={()=>setCitationJob(null)}><Badge tone={verdictTone[citationJob.verdict]}>{label('verdict',citationJob.verdict)}</Badge><h3>{citationJob.title}</h3><p>{citationJob.reasonTemplate}</p>{citationJob.citations.map((citation,index)=><div key={index}><blockquote>“{citation.quote}”</blockquote><p className="source">{label('sourceType',citation.sourceType)} · {citation.documentTitle} · {citation.page}쪽</p></div>)}<Link className="button primary full" to={`/jobs/${citationJob.jobId}`}>직무 상세 보기</Link></SidePanel>}
    {guide&&<Modal close={()=>setGuide(false)}><div className="complete-icon">✓</div><h2>첫 직무를 담았어요</h2><p>담은 직무는 익명으로 집계되어 모집 현황에 반영돼요. 개인 정보는 표시되지 않아요.</p><div className="button-row center"><Link className="button primary" to="/plan">내 지망으로</Link><button className="button" onClick={()=>setGuide(false)}>계속 둘러보기</button></div></Modal>}
  </main>
}
