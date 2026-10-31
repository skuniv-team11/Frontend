import { useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { approve, getApproval } from '../../api/application'
import { errorMessage } from '../../api/client'
import { label } from '../../api/reference'
import { Empty, ErrorBox, InstitutionLogo, Loading } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, fmtDateTime } from '../../lib/format'
import './Apply.css'

// 학과(부)장 승인(공개, 상단 메뉴 없음) — #42 승인할 내용 · #43 승인
// 지원서(APPLICATION)는 이름 · 학번 · 학과 · 학년 · 1~3지망, 학점 인정(CREDIT)은 실습한 자리만 보인다.
export function ApprovalPage() {
  const { token } = useParams()
  const load = useCallback((signal) => getApproval(token, signal), [token])
  const approval = useRequest(load)
  const codes = useCodes()
  const [busy, setBusy] = useState(false)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState(null)

  const onApprove = async () => {
    setBusy(true); setError(null)
    try {
      approval.mutate(await approve(token))
    } catch (e) {
      if (e.code === 'STATE_CONFLICT') setStale(true)
      else if (e.code === 'APPROVAL_NOT_FOUND') approval.reload()
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  const notFound = approval.error?.code === 'APPROVAL_NOT_FOUND'
  const data = approval.data
  return <div className="v2-public ap-public">
    <header className="ap-public-top"><span className="brand">현장뛰자<span>.</span></span><small>서경대학교 현장실습지원센터 · 표준 현장실습학기제</small></header>
    <main className="ap-public-main">
      {!data && approval.loading && <Loading text="승인할 내용을 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." />}
      {notFound && <Empty title="없거나 닫힌 링크예요">{approval.error.message}. 학생에게 새 링크를 받아 주세요.</Empty>}
      {approval.error && !notFound && <ErrorBox error={approval.error} fallback="승인할 내용을 불러오지 못했어요." retry={approval.reload} />}
      {data && <ApprovalCard data={data} codes={codes} stale={stale || data.status === 'STALE'} busy={busy} error={error} onApprove={onApprove} />}
    </main>
  </div>
}

function ApprovalCard({ data, codes, stale, busy, error, onApprove }) {
  const credit = data.kind === 'CREDIT'
  const student = data.student ?? {}
  const name = student.nameKo || '학생'
  const status = stale ? 'STALE' : data.status
  const [badgeText, tone] = { APPROVED: ['승인됨', 'green'], REQUESTED: ['승인 대기', 'blue'], STALE: ['새 링크 필요', 'orange'] }[status] ?? [label(codes, 'approvalStatus', status), '']
  const term = data.round?.termCode ?? ''
  const placement = data.placement

  return <>
    <section className="fx-card ap-approve">
      <div className="ap-approve-head">
        <div>
          <span className="fx-kicker">학과(부)장 승인 · {label(codes, 'approvalKind', data.kind) || (credit ? '학점 인정' : '지원서')}</span>
          <h1 className="fx-h2">{term} {credit ? '현장실습 학점 인정 승인' : '현장실습 지원서 승인'}</h1>
        </div>
        <span className={`badge ${tone}`}>{badgeText}</span>
      </div>
      <p className="fx-sub">{credit
        ? `${name} 학생이 현장실습을 마쳤고, 센터가 기관 서류(평가표 · 출근부)를 모두 받았어요. 학점 인정을 승인해 주세요.`
        : `${name} 학생이 표준 현장실습학기제에 지원하려고 해요. 지원서를 내기 전에 학과(부)장 승인이 필요해요. 학적과 지망을 확인하고 승인해 주세요.`}</p>

      <dl className="fx-rows">
        <div><dt>성명</dt><dd>{student.nameKo || '—'}</dd></div>
        <div><dt>학번</dt><dd>{student.studentNo || '—'}</dd></div>
        <div><dt>학과(부)</dt><dd>{student.department?.name || '—'}</dd></div>
        <div><dt>학년</dt><dd>{student.grade ? `${student.grade}학년` : '—'}</dd></div>
        <div><dt>요청</dt><dd>{fmtDateTime(data.requestedAt) || '—'}</dd></div>
      </dl>

      {!credit && <>
        <h3>1~3지망</h3>
        {(data.picks ?? []).length === 0 ? <p className="fx-small" style={{ margin: 0 }}>정한 지망이 없어요.</p>
          : data.picks.map((pick) => <div key={pick.rank} className="ap-ppick"><b>{pick.rank}지망</b><InstitutionLogo institution={pick.institution} compact /><span>{pick.title}<small>{pick.institution?.name}</small></span></div>)}
      </>}

      {credit && <>
        <h3>실습한 자리</h3>
        {placement ? <div className="ap-ppick"><b>실습</b><InstitutionLogo institution={placement.institution} compact /><span>{placement.title}<small>{placement.institution?.name}{placement.team ? ` · ${placement.team}` : ''}{placement.periodStart ? ` · ${fmtDate(placement.periodStart)} ~ ${fmtDate(placement.periodEnd)}` : ''}</small></span></div>
          : <p className="fx-small" style={{ margin: 0 }}>실습한 자리 정보가 없어요.</p>}
      </>}

      <div className="ap-approve-act">
        {status === 'APPROVED' && <div className="ap-done" role="status">✓ 승인했어요<small>{fmtDateTime(data.approvedAt)} 승인 · 학생 화면에 바로 '승인됨'으로 보여요.</small></div>}
        {status === 'STALE' && <div className="fx-callout warn" role="alert"><span className="fx-callout-icon">!</span><span><b>학생이 내용을 바꿔 새 링크가 필요해요.</b> 승인을 요청한 뒤 지원서 · 지망 · 학적이 바뀌어 이 링크로는 승인할 수 없어요. 학생에게 새 링크를 받아 주세요.</span></div>}
        {status === 'REQUESTED' && <>
          <button type="button" className="fx-btn primary lg block" disabled={busy} onClick={onApprove}>{busy ? '승인하는 중…' : '승인'}</button>
          <p className="fx-small">{credit ? '승인하면 센터 마무리 화면에 승인됨으로 보여요. 학생 서류까지 모이면 학점 인정 명단에 들어가요.' : '승인하면 학생이 지원서를 낼 수 있어요. 학생 화면에 바로 \'승인됨\'으로 보여요.'}</p>
        </>}
        {error && <p className="fx-small fx-red" role="alert" style={{ textAlign: 'center' }}>{errorMessage(error, '승인하지 못했어요. 잠시 뒤 다시 시도해 주세요.')}</p>}
      </div>
    </section>
    <p className="fx-small ap-public-foot">이 화면은 링크를 받은 사람만 로그인 없이 열 수 있어요. 학생의 이름 · 학번 · 학과 · 학년과 {credit ? '실습한 자리' : '지망'}만 보여요.</p>
  </>
}
