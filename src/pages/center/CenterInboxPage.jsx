import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getCenterApplication, getCenterApplications, setApplicationStatus } from '../../api/center'
import { getCurrentRound, label } from '../../api/reference'
import { Modal } from '../../components/Shell'
import { Empty, ErrorBox, InstitutionLogo, Loading, VerdictBadge, VirtualTag } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, fmtDateTime } from '../../lib/format'
import { CenterDemoBanner, ErrorLine, StatusBadge, md, stageOf, stageRange, studentLine, useDemoReload } from './centerKit'
import './CenterPage.css'
import './CenterV2.css'

// 상태별 수 탭(#46 counts) — 전체 · 새로 들어옴 · 접수 완료 · 보완 요청 · 매칭
const TABS = [['ALL', 'all'], ['SUBMITTED', 'submitted'], ['RECEIVED', 'received'], ['FIX_REQUESTED', 'fixRequested'], ['MATCHED', 'matched']]
// 별지 제5호 자기소개서 4문항
const ESSAY_TITLES = ['지원동기', '성격 및 장단점', '경력사항 및 단체활동', '기타 자유 기술']
const ESSAY_MIN = 300
const REASON_MIN = 5
const REASON_MAX = 300

const pickText = (pick) => `${pick.institution?.name ?? ''} · ${pick.title}`
const dotted = (iso) => (iso ? String(iso).slice(0, 10).replaceAll('-', '.') : '')

export function CenterInboxPage() {
  const { id } = useParams()
  const codes = useCodes()
  const list = useRequest(getCenterApplications)
  const round = useRequest(getCurrentRound)
  useDemoReload(list.reload)
  return id
    ? <InboxDetail key={id} id={id} list={list} codes={codes} round={round.data} />
    : <InboxList list={list} codes={codes} round={round.data} />
}

function InboxHead({ round, title, sub }) {
  const apply = stageOf(round, 'APPLY')
  return <div className="center-head">
    <header className="page-title"><span>{round ? `${round.termCode} · 별지 제5호 지원서` : '별지 제5호 지원서'}</span><h1>{title}</h1>{sub && <p>{sub}</p>}</header>
    {apply && <div className="center-head-side"><span className="fx-small" style={{ fontWeight: 800 }}>신청 기간</span><span className="fx-dday gray">{fmtDate(apply.startsOn, true)} ~ {fmtDate(apply.endsOn, true)}</span></div>}
  </div>
}

function InboxList({ list, codes, round }) {
  const [params, setParams] = useSearchParams()
  const filter = TABS.some(([status]) => status === params.get('status')) ? params.get('status') : 'ALL'
  const pickTab = (status) => setParams(status === 'ALL' ? {} : { status }, { replace: true })
  const data = list.data
  const items = data ? (filter === 'ALL' ? data.items : data.items.filter((item) => item.status === filter)) : []

  return <main className="center-page cv2 cv2-flow">
    <CenterDemoBanner note="체험 학생 계정으로 낸 지원서는 실제로 들어와요" />
    <InboxHead round={round} title="들어온 지원서를 확인해요" sub="학과(부)장 승인을 받아 낸 지원서만 들어와요. 줄을 누르면 지원서 한 부를 열어 접수하거나 보완을 요청해요." />
    {!data ? (list.error ? <ErrorBox error={list.error} fallback="접수함을 불러오지 못했어요." retry={list.reload} /> : <Loading text="접수함을 불러오는 중…" note="서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요." />) : <>
      <section className="metrics ib" aria-label="상태별 수">{TABS.map(([status, key]) => <button type="button" key={status} className={filter === status ? 'on' : ''} aria-pressed={filter === status} onClick={() => pickTab(status)}><small>{status === 'ALL' ? '전체' : label(codes, 'applicationStatus', status)}</small><b>{data.counts[key] ?? 0}건</b></button>)}</section>
      <div className="dashboard">
        <div className="fx-stack">
          {list.error && <ErrorBox error={list.error} fallback="다시 불러오지 못했어요." retry={list.reload} />}
          {items.length === 0 ? <Empty title={filter === 'ALL' ? '아직 들어온 지원서가 없어요' : `'${label(codes, 'applicationStatus', filter)}' 지원서가 없어요`}>{filter === 'ALL' ? '학생이 학과(부)장 승인을 받아 내면 접수번호 순으로 들어와요.' : '위 칸을 눌러 다른 상태를 봐요.'}</Empty>
            : <section className="fx-table">
              <div className="fx-thead ib-cols"><span>접수번호</span><span>학생</span><span>1지망 · 2지망 · 3지망</span><span>상담 이수</span><span>상태</span></div>
              {items.map((item) => <Link key={item.applicationId} className="fx-tr ib-cols ib-row" to={`/center/inbox/${item.applicationId}`}>
                <span>{item.receiptNo}<small>{md(item.submittedAt)} 제출</small></span>
                <span><b>{item.student?.nameKo}</b><VirtualTag show={item.virtual} /><small>{studentLine(item.student)}</small></span>
                <span className="ib-choice">{item.picks.map((pick, index) => <span key={pick.rank}>{index > 0 && '  ·  '}<i>{pick.rank}</i>{pickText(pick)}</span>)}</span>
                <span>{item.counselCount > 0 ? `${item.counselCount}회` : '-'}</span>
                <span><StatusBadge codes={codes} status={item.status} /></span>
              </Link>)}
            </section>}
        </div>
        <aside className="fx-stack">
          <section className="fx-card tight"><h3 className="fx-h3">상태 바꾸기</h3>
            <p className="fx-small">지원서를 열어 [접수] 또는 [보완 요청]을 눌러요. 바꾸면 학생의 내 현장실습 타임라인이 바로 바뀌어요. 보완 요청에는 이유를 적어 보내요.</p>
            <div className="c-line" style={{ marginTop: 8 }}><span>새로 들어옴<small>접수하거나 보완을 요청해요</small></span><b>{data.counts.submitted}건</b></div>
            <div className="c-line"><span>보완 요청<small>학생이 고쳐서 다시 내면 새로 들어옴으로 바뀌어요</small></span><b>{data.counts.fixRequested}건</b></div>
          </section>
          <section className="fx-card tight"><h3 className="fx-h3">다음 단계</h3>
            <p className="fx-small">신청 기간이 끝나면 접수 완료한 지원서를 1~3지망 중 한 곳에 매칭해요{round ? `(${stageRange(round, 'MATCH')})` : ''}.</p>
            <Link className="v2-link" style={{ marginTop: 10, fontSize: 12 }} to="/center/match">매칭 · 선발 →</Link>
          </section>
        </aside>
      </div>
    </>}
  </main>
}

function FixDialog({ app, close, submit }) {
  const [reason, setReason] = useState(app.status === 'FIX_REQUESTED' ? app.fixReason ?? '' : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const length = reason.trim().length
  const ok = length >= REASON_MIN && length <= REASON_MAX
  return <Modal className="cv2-modal" close={close}>{(dismiss) => <form onSubmit={async (event) => {
    event.preventDefault()
    if (!ok || busy) return
    setBusy(true); setError(null)
    const result = await submit(reason.trim())
    setBusy(false)
    if (result === true) dismiss(); else setError(result)
  }}>
    <h2>보완 요청 보내기</h2>
    <p className="fx-small">{app.applicant?.nameKo} · 접수번호 {app.receiptNo}</p>
    <label className="fx-label" htmlFor="fix-reason">보완할 점 ({REASON_MIN}~{REASON_MAX}자)</label>
    <textarea id="fix-reason" className="fx-textarea" maxLength={REASON_MAX} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="예: 자기소개서 1번에 지원 기관 이름이 들어 있어요. 세 지망에 공통으로 맞게 고쳐 주세요." autoFocus />
    <p className="fx-small">학생의 지원서 화면에 이 문장이 그대로 보여요. 이미 고른 매칭은 지워져요.</p>
    <ErrorLine error={error} />
    <div className="cv2-modal-foot">
      <span className={`fx-count ${ok ? 'ok' : 'short'}`}>{length} / {REASON_MAX}자{length < REASON_MIN ? ` · ${REASON_MIN}자 이상` : ''}</span>
      <div><button type="button" className="fx-btn sm" onClick={dismiss}>취소</button><button type="submit" className="fx-btn sm primary" disabled={!ok || busy}>{busy ? '보내는 중…' : '보완 요청 보내기'}</button></div>
    </div>
  </form>}</Modal>
}

function InboxDetail({ id, list, codes, round }) {
  const load = useCallback((signal) => getCenterApplication(id, signal), [id])
  const app = useRequest(load)
  useDemoReload(app.reload)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState('')
  const [fixOpen, setFixOpen] = useState(false)
  const data = app.data

  // 처리 → 지원서 다시 그리기 + 목록 다시 불러오기. 실패하면 오류를 돌려준다(대화 상자 안에 보임)
  const change = async (status, reason) => {
    setBusy(true); setError(null); setDone('')
    try {
      const next = await setApplicationStatus(id, status, reason)
      app.mutate(next)
      list.reload()
      setDone(status === 'RECEIVED' ? '접수했어요. 학생 타임라인에 접수 완료로 보여요.' : '보완 요청을 보냈어요. 학생이 고쳐서 다시 내면 새로 들어옴으로 바뀌어요.')
      return true
    } catch (caught) {
      if (status === 'RECEIVED') setError(caught)
      return caught
    } finally {
      setBusy(false)
    }
  }

  const items = list.data?.items ?? []
  const index = items.findIndex((item) => String(item.applicationId) === String(id))
  const prev = index > 0 ? items[index - 1] : null
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null

  if (!data) {
    return <main className="center-page cv2 cv2-flow"><CenterDemoBanner />
      <div className="center-head"><header className="page-title"><span>별지 제5호 지원서</span><h1>지원서 한 부</h1></header></div>
      {app.error ? <ErrorBox error={app.error} fallback="지원서를 불러오지 못했어요." retry={app.error.code === 'APPLICATION_NOT_FOUND' ? undefined : app.reload}>{app.error.code === 'APPLICATION_NOT_FOUND' && <Link className="fx-btn" to="/center/inbox">접수함으로</Link>}</ErrorBox> : <Loading text="지원서를 불러오는 중…" />}
    </main>
  }

  const { applicant = {}, academic = {}, resume = {}, approval } = data
  const status = data.status
  const warnOf = (i) => data.essayWarnings?.find((warning) => warning.index === i)
  const practice = stageOf(round, 'PRACTICE')
  const receiveHint = { RECEIVED: '이미 접수 완료한 지원서예요.', FIX_REQUESTED: '보완 요청 중이에요. 학생이 고쳐서 다시 내면 접수할 수 있어요.', MATCHED: '매칭이 확정된 지원서는 상태를 바꿀 수 없어요.' }[status]
  const check = (on) => <span className={`cv2-mark ${on ? 'ok' : 'no'}`}>{on ? '✓' : '–'}</span>
  const empty = (value) => (value == null || value === '' ? <span className="cv2-none">–</span> : value)

  return <main className="center-page cv2 cv2-flow">
    <CenterDemoBanner note={data.virtual ? '이 지원서는 가상 지원자예요' : '체험 학생 계정이 낸 지원서예요'} />
    <div className="center-head">
      <header className="page-title"><span>{data.round?.termCode} · 별지 제5호 지원서 · 접수번호 {data.receiptNo}</span><h1>{applicant.nameKo} 지원서<VirtualTag show={data.virtual} /></h1></header>
    </div>
    {app.error && <ErrorBox error={app.error} fallback="다시 불러오지 못했어요." retry={app.reload} />}
    <div className="dashboard">
      <section className="fx-card cv2-sheet" aria-label="지원서 한 부">
        <div className="cv2-sheet-head">
          <div><small>별지 제5호</small><h2>{data.round?.termCode} 표준 현장실습학기제 지원서</h2></div>
          <div><StatusBadge codes={codes} status={status} /><span>접수번호 {data.receiptNo}</span><span>{fmtDateTime(data.submittedAt)} 제출</span></div>
        </div>

        <div className="cv2-sec"><h3>1. 신청서 · 기본정보</h3>
          <table className="cv2-table"><tbody>
            <tr><th>성명(한글)</th><td>{empty(applicant.nameKo)}</td><th>성명(영문)</th><td>{empty(applicant.nameEn)}</td></tr>
            <tr><th>생년월일</th><td>{empty(dotted(applicant.birthDate))}</td><th>성별</th><td>{empty(applicant.gender ? label(codes, 'gender', applicant.gender) : null)}</td></tr>
            <tr><th>연락처</th><td>{empty(applicant.phone)}</td><th>이메일</th><td>{empty(applicant.email)}</td></tr>
            <tr><th>현 주소</th><td colSpan={3}>{empty(applicant.address)}</td></tr>
          </tbody></table>
        </div>

        <div className="cv2-sec"><h3>2. 학적정보<small>낼 때 고정한 값</small></h3>
          <table className="cv2-table"><tbody>
            <tr><th>학과(부)</th><td>{empty(academic.department?.name)}</td><th>학번</th><td>{empty(applicant.studentNo)}</td></tr>
            <tr><th>학년</th><td>{academic.grade ? `${academic.grade}학년` : empty(null)}</td><th>이수 학기</th><td>{academic.completedSemesters != null ? `${academic.completedSemesters}학기` : empty(null)}</td></tr>
            <tr><th>평균평점</th><td>{academic.gpa != null ? `${academic.gpa} / 4.5` : empty(null)}</td><th>졸업예정</th><td>{academic.graduationExpected ? '예' : '아니요'}</td></tr>
            <tr><th>부 · 복수전공</th><td colSpan={3}>{applicant.minorMajor || <span className="cv2-none">없음</span>}</td></tr>
          </tbody></table>
        </div>

        <div className="cv2-sec"><h3>3. 희망 실습기관 · 1~3지망<small>판정은 낼 때 고정한 값</small></h3>
          <table className="cv2-table">
            <colgroup><col style={{ width: 70 }} /><col /><col style={{ width: 160 }} /></colgroup>
            <thead><tr><th>지망</th><th>기관 · 부서 · 직무</th><th>지원 조건 판정</th></tr></thead>
            <tbody>{data.picks.length === 0 ? <tr><td colSpan={3} className="empty">지망이 없어요</td></tr> : data.picks.map((pick) => <tr key={pick.rank}>
              <td><b>{pick.rank}지망</b></td>
              <td><div className="cv2-pick"><InstitutionLogo institution={pick.institution} compact /><span>{pick.title}<small>{pick.institution?.name}{pick.team ? ` · ${pick.team}` : ''}</small></span></div></td>
              <td><VerdictBadge verdict={pick.verdict} />{pick.closed && <span className="badge gray" style={{ marginLeft: 4 }}>마감</span>}</td>
            </tr>)}</tbody>
          </table>
          {practice && <p>실습 기간 {dotted(practice.startsOn)} ~ {dotted(practice.endsOn)} · 한 부가 1~3지망 기관에 같이 가요.</p>}
        </div>

        <div className="cv2-sec"><h3>4. 이력서</h3>
          <table className="cv2-table">
            <thead><tr><th style={{ width: 90 }}>구분</th><th>자격 · 어학 · 교육명</th><th>발급 · 교육기관</th><th style={{ width: 100 }}>취득일</th></tr></thead>
            <tbody>{(resume.certificates ?? []).length === 0 ? <tr><td colSpan={4} className="empty">없음</td></tr> : resume.certificates.map((item, i) => <tr key={i}><td>{label(codes, 'resumeKind', item.kind)}</td><td>{empty(item.name)}</td><td>{empty(item.issuer)}</td><td>{empty(item.acquiredOn)}</td></tr>)}</tbody>
          </table>
          <table className="cv2-table" style={{ marginTop: 10 }}>
            <thead><tr><th style={{ width: 90 }}>수상</th><th>수상명</th><th>수여 기관</th><th style={{ width: 100 }}>수상일</th></tr></thead>
            <tbody>{(resume.awards ?? []).length === 0 ? <tr><td colSpan={4} className="empty">없음</td></tr> : resume.awards.map((item, i) => <tr key={i}><td>수상</td><td>{empty(item.name)}{item.detail && <small>{item.detail}</small>}</td><td>{empty(item.issuer)}</td><td>{empty(item.awardedOn)}</td></tr>)}</tbody>
          </table>
          <table className="cv2-table" style={{ marginTop: 10 }}>
            <thead><tr><th style={{ width: 150 }}>경력 기간</th><th>회사</th><th>부서 · 직위 · 역할</th><th style={{ width: 100 }}>비고</th></tr></thead>
            <tbody>{(resume.careers ?? []).length === 0 ? <tr><td colSpan={4} className="empty">없음</td></tr> : resume.careers.map((item, i) => <tr key={i}><td>{empty(item.period)}</td><td>{empty(item.company)}</td><td>{empty(item.role)}</td><td>{item.note || '-'}</td></tr>)}</tbody>
          </table>
        </div>

        <div className="cv2-sec"><h3>5. 자기소개서<small>4문항 · 각 {ESSAY_MIN}자 이상</small></h3>
          {ESSAY_TITLES.map((title, i) => {
            const text = data.essays?.[i] ?? ''
            const warning = warnOf(i)
            return <div className="cv2-essay" key={title}>
              <header><b>{i + 1}. {title}</b><span className={text.length < ESSAY_MIN ? 'short' : ''}>{text.length}자</span></header>
              <p>{text || '(비어 있음)'}</p>
              {warning && <div className="cv2-warn">1~3지망 기관 이름이 들어 있어요: {warning.institutions.join(', ')} — 한 부가 세 기관에 같이 가요.</div>}
            </div>
          })}
        </div>

        <div className="cv2-sec"><h3>6. 서약 · 동의 · 서명</h3>
          <table className="cv2-table"><tbody>
            <tr><th>참여 서약</th><td>{check(data.pledge)} 서약 내용을 읽었고 표준현장실습학기제를 신청합니다</td></tr>
            <tr><th>개인정보 수집 · 이용</th><td>{check(data.consents?.collect)} {data.consents?.collect ? '동의함' : '동의 안 함'}</td></tr>
            <tr><th>제3자 제공</th><td>{check(data.consents?.thirdParty)} {data.consents?.thirdParty ? '동의함(1~3지망 기관)' : '동의 안 함'}</td></tr>
          </tbody></table>
          <div className="cv2-sign"><span>{fmtDate(data.submittedAt)}</span><span>신청인</span><b>{data.signature || '(서명 없음)'}</b></div>
        </div>

        <div className="cv2-sec"><h3>7. 학과(부)장 승인</h3>
          <table className="cv2-table"><tbody>
            <tr><th>상태</th><td>{approval ? label(codes, 'approvalStatus', approval.status) : empty(null)}</td><th>승인 시각</th><td>{approval?.approvedAt ? fmtDateTime(approval.approvedAt) : empty(null)}</td></tr>
            <tr><th>요청 시각</th><td colSpan={3}>{approval?.requestedAt ? fmtDateTime(approval.requestedAt) : empty(null)}</td></tr>
          </tbody></table>
        </div>
      </section>

      <aside className="fx-stack cv2-noprint">
        <section className="fx-card tight ib-detail">
          <div className="fx-row between"><StatusBadge codes={codes} status={status} /><span className="fx-small">{data.receiptNo}</span></div>
          <h2>{applicant.nameKo}<VirtualTag show={data.virtual} /></h2>
          <p className="fx-small">{studentLine(academic)} · 이수 {academic.completedSemesters}학기 · 평점 {academic.gpa}</p>
          <div className="c-line" style={{ marginTop: 6 }}><span>제출<small>보완 뒤 다시 내도 처음 낸 시각</small></span><span className="fx-small">{md(data.submittedAt)}</span></div>
          <div className="c-line"><span>접수</span><span className="fx-small">{data.receivedAt ? md(data.receivedAt) : '-'}</span></div>
          <div className="c-line"><span>진로취업상담 이수<small>매칭 · 선발 가점</small></span><span className={`badge ${data.counselCount > 0 ? 'green' : 'gray'}`}>{data.counselCount > 0 ? `${data.counselCount}회` : '없음'}</span></div>
          {status === 'FIX_REQUESTED' && data.fixReason && <div className="fx-callout warn" style={{ marginTop: 10, flexDirection: 'column', gap: 2, fontSize: 12 }}><b>보완 요청 이유</b>{data.fixReason}</div>}
          <div className="ib-actions">
            <button type="button" className={`fx-btn sm ${status === 'RECEIVED' ? 'dark' : 'primary'}`} disabled={busy || status !== 'SUBMITTED'} onClick={() => change('RECEIVED')}>{status === 'RECEIVED' ? '✓ 접수 완료' : busy ? '처리 중…' : '접수'}</button>
            <button type="button" className={`fx-btn sm ${status === 'FIX_REQUESTED' ? 'dark' : ''}`} disabled={busy || status === 'MATCHED'} onClick={() => { setError(null); setDone(''); setFixOpen(true) }}>{status === 'FIX_REQUESTED' ? '보완 요청 다시 보내기' : '보완 요청'}</button>
            <button type="button" className="fx-btn sm" onClick={() => window.print()}>인쇄</button>
          </div>
          {receiveHint && !done && <p className="cv2-hint">{receiveHint}</p>}
          <ErrorLine error={error} />
          {done && <p className="cv2-ok" role="status">{done}</p>}
        </section>
        <section className="fx-card tight"><h3 className="fx-h3">낼 때 확인한 것</h3>
          <ul className="cv2-check-list">{(data.checklist ?? []).map((item) => <li key={item.item}><span>{label(codes, 'applicationItem', item.item)}</span>{check(item.done)}</li>)}</ul>
          {data.virtual && <p className="cv2-hint">가상 지원자는 자기소개서 · 연락처를 비워 둔 시연용 지원서예요.</p>}
        </section>
        <nav className="ib-nav" aria-label="다른 지원서">
          {prev ? <Link to={`/center/inbox/${prev.applicationId}`}><small>← 이전</small>{prev.student?.nameKo}</Link> : <span><small>← 이전</small>없음</span>}
          {next ? <Link to={`/center/inbox/${next.applicationId}`}><small>다음 →</small>{next.student?.nameKo}</Link> : <span><small>다음 →</small>없음</span>}
        </nav>
      </aside>
    </div>
    {fixOpen && <FixDialog app={{ ...data, applicant }} close={() => setFixOpen(false)} submit={(reason) => change('FIX_REQUESTED', reason)} />}
  </main>
}
