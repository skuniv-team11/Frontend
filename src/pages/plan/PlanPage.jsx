import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken } from '../../api/client'
import { getMyPlan, planErrorMessage, removePlanItem, saveRanks } from '../../api/plan'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { useRequest } from '../../hooks/useRequest'

const formatAddedAt = (value) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// 담은 직무 목록. 목록 순서가 곧 지망 순서다 — ↑↓로 바꾸면 위에서 3개를 1~3지망으로 정해 순위 전체를 보낸다(PUT ranks).
// 순서는 누르자마자 화면에 먼저 반영하고(실패하면 되돌림) 서버 응답으로 맞춘다. [빼기]는 담기 취소(DELETE) 뒤 그 직무만 목록에서 지운다 — 다시 불러오지 않는다. 지망 점검(POST check — 판정·모집 신호·빈 자리)은 다음 연동에서 붙인다.
const rankErrorMessage = (error) => {
  if (error.code === 'RANK_INVALID') return `순위를 정하지 못했어요. ${error.message}`
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인해 주세요.'
  return '순위를 정하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}
function PlanList({ plan }) {
  const [removing, setRemoving] = useState(null); const [removeError, setRemoveError] = useState('')
  const [ranking, setRanking] = useState(false); const [rankError, setRankError] = useState('')
  const busy = removing !== null || ranking
  const applyOrder = async (ordered) => {
    const previous = plan.data
    plan.mutate({ ...previous, items: ordered.map((item, index) => ({ ...item, rank: index < 3 ? index + 1 : null })) })
    setRanking(true); setRankError('')
    try { plan.mutate(await saveRanks(ordered.slice(0, 3).map((item, index) => ({ jobId: item.jobId, rank: index + 1 })))) }
    catch (caught) { plan.mutate(previous); setRankError(rankErrorMessage(caught)) }
    finally { setRanking(false) }
  }
  const move = (index, step) => {
    // 맨 위에서 ↑, 맨 아래에서 ↓는 바꿀 자리가 없으니 아무것도 하지 않는다
    if (index + step < 0 || index + step >= plan.data.items.length) return
    const ordered = [...plan.data.items]
    ;[ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]]
    applyOrder(ordered)
  }
  const clearRanks = async () => {
    setRanking(true); setRankError('')
    try { plan.mutate(await saveRanks([])) }
    catch (caught) { setRankError(rankErrorMessage(caught)) }
    finally { setRanking(false) }
  }
  const remove = async (jobId) => {
    setRemoving(jobId); setRemoveError('')
    try { await removePlanItem(jobId); plan.mutate({ ...plan.data, items: plan.data.items.filter(item => item.jobId !== jobId) }) }
    catch (caught) { setRemoveError(planErrorMessage(caught, '빼기')) }
    finally { setRemoving(null) }
  }
  if (!getToken()) return <p className="notice">로그인하면 담은 직무를 볼 수 있어요. <Link className="link-button" to="/login">로그인하기 →</Link></p>
  if (plan.loading) return <p className="notice">담은 직무를 불러오는 중… 서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p>
  if (plan.error?.code === 'FORBIDDEN_ROLE') return <p className="notice">내 지망은 학생 계정에서만 쓸 수 있어요.</p>
  if (plan.error?.status === 401) return <p className="notice">로그인 정보가 없거나 만료됐어요. <Link className="link-button" to="/login">다시 로그인하기 →</Link></p>
  if (plan.error) return <p className="notice danger">담은 직무를 불러오지 못했어요. <button className="link-button" onClick={plan.reload}>다시 불러오기</button></p>
  if (!plan.data.items.length) return <p className="notice">아직 담은 직무가 없어요. 직무 찾기에서 마음에 드는 직무를 담아 보세요. <Link className="link-button" to="/jobs">직무 찾기 →</Link></p>
  const items = plan.data.items
  const hasRanks = items.some(item => item.rank)
  return <>{(removeError || rankError) && <p className="notice danger" role="alert">{removeError || rankError}</p>}<p className="notice">위에서부터 3개가 1~3지망이에요. ↑↓로 순서를 바꾸면 바로 저장돼요.{!hasRanks && <> <button className="link-button" disabled={busy} onClick={() => applyOrder(items)}>지금 순서대로 1~3지망 정하기</button></>}{hasRanks && <> <button className="link-button" disabled={busy} onClick={clearRanks}>순위 모두 지우기</button></>}{ranking && ' 저장하는 중…'}</p><div className="pick-list">{items.map((item, index) => <article className="card pick" key={item.jobId}><b className="rank">{item.rank ? `${item.rank}지망` : '후보'}</b><div><small>{item.institution.name}</small><h3>{item.title}</h3><small>{formatAddedAt(item.addedAt)}에 담음</small></div><div className="pick-actions"><button disabled={busy} aria-label="위로" onClick={() => move(index, -1)}>↑</button><button disabled={busy} aria-label="아래로" onClick={() => move(index, 1)}>↓</button><Link to={`/jobs/${item.jobId}`}>상세</Link><button disabled={busy} onClick={() => remove(item.jobId)}>{removing === item.jobId ? '빼는 중…' : '빼기'}</button></div></article>)}</div></>
}

export function PlanPage(){
  const plan=useRequest(getMyPlan,Boolean(getToken()))
  const ranked=plan.data?.items.filter(item=>item.rank).length??0
  return <main className="content two-column"><section><PageTitle eyebrow="지원 순서를 정해 보세요" title="1~3지망을 점검했어요" description={plan.data?`담은 직무 ${plan.data.items.length}개 · 순위를 정한 직무 ${ranked}개`:'지원 가능 여부와 현재 모집 신호를 함께 확인하세요.'}/><PlanList plan={plan}/><p className="simulation">※ 모집 신호는 시연을 위한 가상 데이터예요.</p><div className="button-row"><Link className="button" to="/plan/apply">지원 준비 체크리스트 →</Link><Link className="button" to="/plan/counsel">상담 준비 요약 →</Link></div></section><ActionCard action={<Link className="button full" to="/jobs">직무 더 담으러 가기</Link>}><h3>비슷한 빈 자리</h3><p>1~3지망 순위를 정하면 지망마다 모집 신호와 자리가 남은 비슷한 직무를 보여 줄 예정이에요.</p></ActionCard></main>
}
