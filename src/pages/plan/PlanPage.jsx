import { Link } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getMyPlan } from '../../api/plan'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { useRequest } from '../../hooks/useRequest'

const formatAddedAt = (value) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// 담은 직무 목록. 순위 바꾸기(PUT ranks)·지망 점검(POST check — 판정·모집 신호·빈 자리)은 다음 연동에서 붙인다.
function PlanList({ plan }) {
  if (!getToken()) return <p className="notice">로그인하면 담은 직무를 볼 수 있어요. <Link className="link-button" to="/login">로그인하기 →</Link></p>
  if (plan.loading) return <p className="notice">담은 직무를 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>
  if (plan.error?.code === 'FORBIDDEN_ROLE') return <p className="notice">내 지망은 학생 계정에서만 쓸 수 있어요.</p>
  if (plan.error?.status === 401) return <p className="notice">로그인 정보가 없거나 만료됐어요. <Link className="link-button" to="/login">다시 로그인하기 →</Link></p>
  if (plan.error) return <p className="notice danger">담은 직무를 불러오지 못했어요. <button className="link-button" onClick={plan.reload}>다시 불러오기</button></p>
  if (!plan.data.items.length) return <p className="notice">아직 담은 직무가 없어요. 직무 찾기에서 마음에 드는 직무를 담아 보세요. <Link className="link-button" to="/jobs">직무 찾기 →</Link></p>
  return <div className="pick-list">{plan.data.items.map(item => <article className="card pick" key={item.jobId}><b className="rank">{item.rank ? `${item.rank}지망` : '순위 없음'}</b><div><small>{item.institution.name}</small><h3>{item.title}</h3><small>{formatAddedAt(item.addedAt)}에 담음</small></div><div className="pick-actions"><button disabled title="순위 정하기는 준비 중이에요">↑</button><button disabled title="순위 정하기는 준비 중이에요">↓</button><Link to={`/jobs/${item.jobId}`}>상세</Link></div></article>)}</div>
}

export function PlanPage(){
  const plan=useRequest(getMyPlan,Boolean(getToken()))
  const ranked=plan.data?.items.filter(item=>item.rank).length??0
  return <main className="content two-column"><section><PageTitle eyebrow="지원 순서를 정해 보세요" title="1~3지망을 점검했어요" description={plan.data?`담은 직무 ${plan.data.items.length}개 · 순위를 정한 직무 ${ranked}개`:'지원 가능 여부와 현재 모집 신호를 함께 확인하세요.'}/><PlanList plan={plan}/><p className="simulation">※ 모집 신호는 시연을 위한 가상 데이터예요.</p><div className="button-row"><Link className="button" to="/plan/apply">지원 준비 체크리스트 →</Link><Link className="button" to="/plan/counsel">상담 준비 요약 →</Link></div></section><ActionCard action={<Link className="button full" to="/jobs">직무 더 담으러 가기</Link>}><h3>비슷한 빈 자리</h3><p>1~3지망 순위를 정하면 지망마다 모집 신호와 자리가 남은 비슷한 직무를 보여 줄 예정이에요.</p></ActionCard></main>
}
