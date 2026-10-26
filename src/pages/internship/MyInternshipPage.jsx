import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyApplication } from '../../api/application'
import { errorMessage, getToken } from '../../api/client'
import { getMyExplore } from '../../api/explore'
import { getMyInternship, markDocument } from '../../api/internship'
import { getMyPlan, removePlanItem, saveRanks } from '../../api/plan'
import { label } from '../../api/reference'
import { Modal, SidePanel } from '../../components/Shell'
import { ErrorBox, InstitutionLogo, Loading, NeedLogin, VerdictBadge, VirtualTag } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, fmtDateTime, won } from '../../lib/format'
import '../plan/PlanPage.css'
import './MyInternship.css'

// 내 현장실습(#44) — 지망부터 학점 인정까지 11단계를 한 타임라인으로. 단계를 누르면 그때 할 일과 버튼.
// 지망 관리는 #19 담은 직무 + #22 순위(전체를 보냄) + #21 빼기. 마무리 서류는 #45 냄 표시만(파일은 받지 않음).

const SUBMITTED = ['SUBMITTED', 'RECEIVED', 'MATCHED']
const md = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')
const when = (s) => {
  if (!s.startsOn) return s.confirmed ? '' : '확인 전'
  if (!s.endsOn) return `${md(s.startsOn)} ~`
  return s.startsOn === s.endsOn ? md(s.startsOn) : `${md(s.startsOn)} ~ ${md(s.endsOn)}`
}
const STATE_TONE = { DONE: 'green', NOW: 'blue', NEXT: 'gray' }
const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const weekdayText = (codes, days = []) => {
  if (!days.length) return ''
  const idx = days.map((d) => WEEK.indexOf(d))
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  const names = days.map((d) => label(codes, 'weekday', d))
  return consecutive && days.length >= 3 ? `${names[0]}~${names[names.length - 1]}` : names.join('·')
}
const stipendText = (stipend) => {
  if (!stipend?.amount) return '미기재'
  return `${stipend.basis === 'HOURLY' ? '시급' : '월'} ${won(stipend.amount)}`
}

// 단계별 고정 안내(2026-2 학생 모집안내 · 운영서식 기준, 프로토타입 문구)
const STAGE_TEXT = {
  PICK: ['1~3지망 정하기', '담은 직무 중 위에서 3개가 1~3지망이 돼요. 1지망은 꼭 정해야 하고, 2·3지망은 선택이에요. 담기는 지원이 아니라서 다른 학생이 몇 명 담았는지는 보여 주지 않아요.'],
  APPLY: ['지원서 쓰고 내기', '제5호 서식(신청서 · 자기소개서 · 개인정보 동의)을 여기서 써요. 학과(부)장 승인을 받은 뒤 신청 기간 안에 내요.'],
  MATCH: ['센터가 한 기관에 매칭', '센터가 기관 요구사항과 이력서 · 자기소개서를 보고 1~3지망 중 한 기관에 매칭해요.'],
  SELECT: ['기관 면접 · 최종 선발', '기관별 서류 · 면접 전형으로 최종 선발해요. 면접 대상이면 꼭 참석해야 해요.'],
  CONTRACT: ['3자 협약 · 보험', '대학 · 기관 · 학생이 3자 협약을 맺어요. 산재보험은 기관이 가입해요.'],
  ORIENTATION: ['사전교육(OT)', '최종 선발 학생은 꼭 참석해요.'],
  PRACTICE: ['실습', '선발되면 기관 · 직무와 실습 시간이 여기 보여요.'],
  MIDCHECK: ['중간점검서', '중간점검서(별지 제6호) 17문항을 써서 내요. 기관은 답을 보지 않아요.'],
  CLOSE: ['실습 마무리 제출', '실습이 끝나면 학생은 수행결과보고서 · 학점인정신청서 · 설문조사서를, 기관은 평가표 · 출근부를 내요.'],
  DEBRIEF: ['후기 간담회', '참여 학생은 꼭 참석하고, 원본 서류를 내요.'],
  CREDIT: ['학점 인정 · 커리어 리포트', '기관 평가와 학과(부)장 승인으로 P/NP가 정해져요.'],
}

// 중간점검서(별지 제6호) 앞 4문항 — 서식 그대로
const MID_QUESTIONS = [
  ['현재 참여 중인 실습 직무 및 내용이 본인의 전공과 관련되게 운영되고 있나요?', ['① 전공과 관련되게 운영되고 있다.', '② 전공과 관련된 부분과 무관한 부분으로 운영되고 있다.', '③ 전공과 무관하게 운영되고 있다.']],
  ['현재 참여 중인 실습 직무 및 내용이 운영계획(공지된 실습업무 범위 및 내용)과 일치되게 운영되고 있나요?', ['① 운영계획과 일치되게 운영되고 있다.', '② 일치되는 부분과 일치하지 않는 부분이 있다.', '③ 운영계획과 달리 운영되고 있다.']],
  ['운영계획 및 협약에 따른 주간 실습일 기준은 어떻게 되나요?', ['① 주 4일', '② 주 5일', '③ 주 6일']],
  ['실제 주간 실습일은 어떻게 되나요?', ['① 주 4일', '② 주 5일', '③ 주 6일', '④ 기타(주 시간)']],
]

const rankError = (error) => (error.code === 'RANK_INVALID' ? `순위를 정하지 못했어요. ${error.message}` : errorMessage(error, '순위를 저장하지 못했어요. 잠시 뒤 다시 해 주세요.'))
const docErrorText = (error) => {
  if (error.code === 'CAREER_REPORT_REQUIRED') return 'REPORT'
  if (error.code === 'STATE_CONFLICT') return '합격을 알린 뒤에 낼 수 있어요.'
  return errorMessage(error, '냄 표시를 하지 못했어요. 잠시 뒤 다시 해 주세요.')
}

function Item({ item }) {
  return <div className="mi-item">
    <div><b>{item.title}{item.virtual && <VirtualTag />}</b>{item.sub && <small>{item.sub}</small>}</div>
    <div className="mi-item-r">
      {item.badge && <span className={`badge ${item.badge[1]}`}>{item.badge[0]}</span>}
      {(item.actions ?? []).map((a) => a.to
        ? <Link key={a.label} className={`mi-do ${a.real ? 'real' : ''}`} to={a.to}>{a.label}</Link>
        : <button key={a.label} type="button" className={`mi-do ${a.real ? 'real' : ''}`} disabled={a.busy} onClick={a.onClick}>{a.busy ? '처리 중…' : a.label}</button>)}
    </div>
  </div>
}

// 담은 직무 — 목록 순서가 지망 순서. ↑↓로 바꾸면 위에서 3개를 1~3지망으로 순위 전체를 보낸다(#22).
function PlanBoard({ plan, picks, onChanged }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const pickOf = useMemo(() => Object.fromEntries((picks ?? []).map((p) => [p.jobId, p])), [picks])
  if (plan.loading && !plan.data) return <Loading text="담은 직무를 불러오는 중…" />
  if (plan.error) return <ErrorBox error={plan.error} retry={plan.reload} />
  const items = plan.data?.items ?? []
  const top = Math.min(3, items.length)
  const needsSync = items.slice(0, 3).some((it, i) => it.rank !== i + 1)
  const saveOrder = async (ordered) => {
    const previous = plan.data
    plan.mutate({ ...previous, items: ordered.map((it, i) => ({ ...it, rank: i < 3 ? i + 1 : null })) })
    setBusy('rank'); setError('')
    try {
      plan.mutate(await saveRanks(ordered.slice(0, 3).map((it, i) => ({ jobId: it.jobId, rank: i + 1 }))))
      onChanged()
    } catch (caught) {
      plan.mutate(previous); setError(rankError(caught))
    } finally { setBusy(null) }
  }
  const move = (index, step) => {
    const ordered = [...items]
    ;[ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]]
    saveOrder(ordered)
  }
  const remove = async (jobId) => {
    setBusy(jobId); setError('')
    try {
      await removePlanItem(jobId)
      plan.mutate({ ...plan.data, items: items.filter((it) => it.jobId !== jobId) })
      onChanged()
    } catch (caught) { setError(errorMessage(caught, '빼지 못했어요. 잠시 뒤 다시 해 주세요.')) } finally { setBusy(null) }
  }
  const closedRanked = items.filter((it) => it.rank && pickOf[it.jobId]?.closed)
  return <div className="mi-pick"><section className="plan-board">
    <div className="plan-board-toolbar"><h2>담은 직무 <small>{items.length}개</small></h2><small>{busy === 'rank' ? '순서를 저장하는 중…' : '위에서 3개가 1~3지망 · 지원서에 들어가요'}</small></div>
    {error && <p className="plan-error" role="alert">{error}</p>}
    {items.length > 0 && needsSync && <div className="mi-pick-sync"><span>아직 지망 순위가 정해지지 않았어요. 지금 순서대로 위에서 {top}개를 1~{top}지망으로 정할까요?</span><button type="button" className="fx-btn sm primary" disabled={Boolean(busy)} onClick={() => saveOrder(items)}>1~{top}지망 정하기</button></div>}
    {closedRanked.length > 0 && <div className="fx-callout warn" style={{ marginBottom: 10 }}><span className="fx-callout-icon">!</span><span>마감된 직무({closedRanked.map((it) => it.title).join(', ')})가 지망에 있으면 지원서를 낼 수 없어요. 순서를 바꾸거나 빼 주세요.</span></div>}
    <div className="pick-list">
      {items.length === 0 && <p className="fx-sub" style={{ margin: '4px 0 12px' }}>아직 담은 직무가 없어요. 직무 찾기나 직무 탐색에서 지원할 직무를 담아 주세요.</p>}
      {items.map((it, index) => {
        const pick = pickOf[it.jobId]
        return <article key={it.jobId} className={`plan-pick ${it.rank ? 'is-ranked' : 'is-candidate'}`} style={{ '--pick-index': index }}>
          <div className="plan-rank"><span>{it.rank ?? '·'}</span><b>{it.rank ? '지망' : '후보'}</b></div>
          <div className="plan-pick-main"><InstitutionLogo institution={it.institution} className="plan-institution-logo" />
            <div className="plan-pick-copy"><small>{it.institution?.name}</small><h3><Link to={`/jobs/${it.jobId}`}>{it.title}</Link></h3>
              <div className="plan-signal">{pick && <span className={`badge ${pick.closed ? 'gray' : 'green'}`}>{pick.closed ? '마감' : '모집 중'}</span>}</div></div></div>
          <div className="plan-order-actions"><button type="button" disabled={Boolean(busy) || index === 0} aria-label={`${it.title} 순서를 위로`} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={Boolean(busy) || index === items.length - 1} aria-label={`${it.title} 순서를 아래로`} onClick={() => move(index, 1)}>↓</button></div>
          <div className="plan-pick-actions"><button type="button" disabled={Boolean(busy)} onClick={() => remove(it.jobId)}>{busy === it.jobId ? '빼는 중…' : '빼기'}</button></div>
        </article>
      })}
      <Link className="plan-add-candidate" aria-label="직무 더 담기" to="/jobs"><span aria-hidden="true">＋</span></Link>
    </div>
  </section></div>
}

// 탐색 결과 중 아직 안 담은 자리(#30)
function ExploreSide({ planItems }) {
  const explore = useRequest(getMyExplore)
  const codes = useCodes()
  const planned = new Set((planItems ?? []).map((it) => it.jobId))
  const rest = (explore.data?.items ?? []).filter((it) => !planned.has(it.jobId)).slice(0, 3)
  return <section className="fx-card tight mi-side"><h3>탐색 결과 · 아직 안 담은 자리</h3>
    {explore.loading && !explore.data ? <p>불러오는 중…</p>
      : explore.error?.code === 'EXPLORE_NOT_FOUND' ? <><p>직무 탐색을 하면 해 본 일 · 하고 싶은 일과 이어지는 자리를 여기 보여 줘요.</p><Link className="v2-link" style={{ marginTop: 10, fontSize: 12 }} to="/explore">직무 탐색 하기 →</Link></>
        : explore.error ? <p>{errorMessage(explore.error)}</p>
          : rest.length === 0 ? <p>탐색 결과의 자리를 모두 담았어요.</p>
            : <>{rest.map((it) => <Link key={it.jobId} className="mi-alt" to={`/jobs/${it.jobId}`}><InstitutionLogo institution={it.institution} compact className="plan-institution-logo is-compact" /><div className="plan-alternative-copy"><small>{it.institution?.name}</small><b>{it.title}</b><div className="plan-alternative-meta"><VerdictBadge verdict={it.verdict} /><span>{label(codes, 'exploreFit', it.fit)}</span></div></div></Link>)}
              <Link className="v2-link" style={{ marginTop: 12, fontSize: 12 }} to="/explore/result">탐색 결과 전체 보기 →</Link></>}
  </section>
}

// 서식 미리 보기(체험용 — 저장하지 않음)
function FormSheet({ kind, data, codes, close }) {
  const [answers, setAnswers] = useState(() => {
    const n = data.placement?.practice?.weekdays?.length
    return n >= 4 && n <= 6 ? { 2: n - 4 } : {}
  })
  const placement = data.placement
  const practice = placement?.practice
  const place = placement ? `${placement.institution?.name} · ${placement.team ?? placement.title}` : '선발되면 채워져요'
  const period = practice ? `${fmtDate(practice.startsOn)} ~ ${fmtDate(practice.endsOn)} · ${practice.weeks}주` : '선발되면 채워져요'
  const title = { contract: '3자 협약 · 보험', midcheck: '중간점검서 · 별지 제6호', credit: '학점인정신청서 · 설문조사서' }[kind]
  return <SidePanel title={title} close={close} className="mi-sheet">
    <p className="mi-sheet-sub"><span className="badge orange">서식과 상태만 · 시연</span> 체험용이라 저장하지 않아요. 실제 서류는 센터 안내에 따라 내요.</p>
    {kind === 'contract' && <>
      <div className="mi-sec"><h3>협약 내용</h3>
        {[['당사자', placement ? `서경대학교 · ${placement.institution?.name} · 학생` : '서경대학교 · 기관 · 학생'], ['실습 기간', period], ['실습 시간', practice ? `${weekdayText(codes, practice.weekdays)} ${practice.workHours ?? ''} · 주 ${Number(practice.weeklyHours)}시간` : '선발되면 채워져요'], ['실습지원비', practice ? `${stipendText(practice.stipend)} · 기관이 매달 학생에게 직접` : '선발되면 채워져요'], ['유급휴일', '1개월 이상 실습하면 1일'], ['보험', '기관이 산재보험에 가입']].map(([a, b]) => <div className="mi-kv" key={a}><span>{a}</span><b>{b}</b></div>)}</div>
      <div className="mi-sec"><h3>실습지원비 받을 계좌</h3><p>기관이 매달 학생에게 직접 보내요. 계좌는 이 서비스에서 받지 않아요(지원서 때도 받지 않았어요).</p></div>
      <div className="mi-sec"><h3>서명</h3><p>협약서를 전자서명만으로 맺을 수 있는지는 센터 확인이 필요해요.</p></div>
      <div className="mi-sec"><h3>수강신청 정정</h3><p>정정 기간에 내가 신청한 과목을 직접 지우면, 센터가 현장실습 교과목을 일괄 신청해요.</p></div>
    </>}
    {kind === 'midcheck' && <>
      {MID_QUESTIONS.map(([q, opts], i) => <div className="mi-q" key={q}><b>{i + 1}. {q}</b>{i === 2 && practice?.weekdays?.length > 0 && <small>초안 · 운영계획서 {weekdayText(codes, practice.weekdays)}</small>}
        <div className="mi-opts">{opts.map((o, j) => <button key={o} type="button" className={`mi-opt ${answers[i] === j ? 'on' : ''}`} onClick={() => setAnswers({ ...answers, [i]: j })}>{o}</button>)}</div></div>)}
      <div className="mi-sec"><p>외 13문항(실습 시간 · 연장 · 야간 · 휴게 · 안전 · 멘토 · 교육시간 비율 · 학교 개입 요청 · 건의사항)은 서식 그대로예요. 기관은 답을 보지 않아요.</p></div>
    </>}
    {kind === 'credit' && <>
      <div className="mi-sec"><h3>학점인정신청서 · 제7호</h3>
        {[['교과목', practice ? `${practice.courseName} · ${practice.credits}학점 · P/NP` : '선발되면 채워져요'], ['실습기관', place], ['실습 기간', period], ['학과(부)장 승인', data.documents ? label(codes, 'approvalStatus', data.documents.creditApproval?.status) : '합격 알림 뒤에 열려요']].map(([a, b]) => <div className="mi-kv" key={a}><span>{a}</span><b>{b}</b></div>)}
        <p style={{ marginTop: 8 }}>센터가 기관 평가표 · 출근부를 모두 받으면 학과(부)장 승인 링크가 생겨요.</p></div>
      <div className="mi-sec"><h3>설문조사서 · 제8호</h3><p>만족도 조사 문항은 서식 그대로예요. 원본 서류는 후기 간담회 때 내요.</p></div>
    </>}
    <div className="mi-sheet-foot"><span className="fx-small">{kind === 'credit' ? "냄 표시는 '종료 · 제출' 단계에서 해요" : '체험용이라 저장하지 않아요'}</span><button type="button" className="fx-btn" onClick={close}>닫기</button></div>
  </SidePanel>
}

export function MyInternshipPage() {
  const loggedIn = Boolean(getToken())
  const internship = useRequest(getMyInternship, loggedIn)
  const plan = useRequest(getMyPlan, loggedIn)
  const codes = useCodes()
  const [sel, setSel] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [docBusy, setDocBusy] = useState(null)
  const [docError, setDocError] = useState('')

  const data = internship.data
  const stages = data?.stages ?? []
  const nowIndex = Math.max(0, stages.findIndex((s) => s.code === data?.now))
  const selIndex = sel ?? nowIndex
  const stage = stages[selIndex]
  const application = data?.application
  const submitted = SUBMITTED.includes(application?.status)
  // 지원서 칸 점검(#37)은 지원서 · 지망 단계를 볼 때만 부른다
  const needApplication = Boolean(data) && ((stage?.code === 'APPLY' && !submitted) || (stage?.code === 'PICK' && submitted))
  const app37 = useRequest(getMyApplication, loggedIn && needApplication)

  if (!loggedIn) return <NeedLogin />
  if (!data) return <main className="fx-page"><div className="fx-shell">
    {internship.error ? <ErrorBox error={internship.error} retry={internship.reload} /> : <Loading text="내 현장실습을 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." />}
  </div></main>

  const L = (group, code) => label(codes, group, code)
  const placement = data.placement
  const practice = placement?.practice
  const documents = data.documents
  const virtual = Boolean(application?.virtual)
  const stageOf = (code) => stages.find((s) => s.code === code)
  const stateBadge = (s) => [s.state === 'DONE' ? '완료' : s.state === 'NOW' ? '지금' : '예정', STATE_TONE[s.state]]
  const sheetLabel = (s) => (s.state === 'NOW' ? '하기' : s.state === 'DONE' ? '보기' : '미리 보기')
  const next = data.next

  // 머리 문장
  const pick = stageOf('PICK'); const apply = stageOf('APPLY')
  let headTitle = `지금은 '${L('stage', data.now)}' 단계예요`
  if (practice && ['PRACTICE', 'MIDCHECK'].includes(data.now)) headTitle = `실습 ${practice.week}주차예요 · ${placement.title}`
  else if (['PICK', 'APPLY'].includes(data.now)) headTitle = submitted ? '지원서를 냈어요 · 센터 매칭을 기다려요' : next?.code === 'APPLY' && next.kind === 'END' ? (next.days > 0 ? `지원서 마감까지 ${next.days}일 남았어요` : '오늘 지원서 마감이에요') : headTitle
  else if (placement?.result === 'PASS' && ['CLOSE', 'DEBRIEF', 'CREDIT'].includes(data.now)) headTitle = `실습을 마쳤어요 · ${placement.title}`
  const headSub = `${fmtDate(data.asOf, true)} 기준 · ${placement ? `${placement.institution?.name} ${placement.team ?? placement.title}${practice ? ` · ${md(practice.startsOn)} ~ ${md(practice.endsOn)}` : ''}` : `${data.round?.termCode ?? ''} 모집 ${md(pick?.startsOn)} ~ ${md(apply?.endsOn)}`}`
  const nextStage = next && stageOf(next.code)
  const single = nextStage && nextStage.startsOn === nextStage.endsOn
  const dayLabel = next ? (single ? L('stage', next.code) : `${L('stage', next.code)} ${L('nextKind', next.kind)}`) : ''
  const dday = next ? (next.days > 0 ? `D-${next.days}` : single ? '오늘' : 'D-DAY') : ''

  // 단계 묶음(지원 · 준비 · 실습 · 마무리)
  const phases = []
  stages.forEach((s) => { const last = phases[phases.length - 1]; if (last?.code === s.phase) last.n += 1; else phases.push({ code: s.phase, n: 1 }) })
  const nowPhase = stages[nowIndex]?.phase

  const mark = async (kind) => {
    setDocBusy(kind); setDocError('')
    try { internship.mutate(await markDocument(kind)) } catch (caught) { setDocError(docErrorText(caught)) } finally { setDocBusy(null) }
  }
  const askMark = (kind) => setConfirm(kind)
  const refresh = () => internship.reload()

  // 단계별 할 일
  const panel = { items: [], notes: [], warn: null, body: null, action: null }
  const s = stage
  if (s) {
    const code = s.code
    if (code === 'PICK') {
      if (submitted) {
        const picks = app37.data?.picks ?? []
        if (app37.loading && !app37.data) panel.body = <Loading text="낸 지망을 불러오는 중…" />
        else if (app37.error) panel.body = <ErrorBox error={app37.error} retry={app37.reload} />
        panel.items = picks.map((p) => ({ title: `${p.rank}지망 · ${p.institution?.name} ${p.title}`, sub: `${fmtDate(application.submittedAt)} 지원서와 함께 냄`, badge: ['냄', 'green'], virtual, actions: [{ to: `/jobs/${p.jobId}`, label: '직무 보기' }] }))
        panel.notes.push('지원서를 낸 뒤에는 지망이 낸 날 값으로 고정돼요. 담은 직무 순서를 바꿔도 낸 지원서에는 들어가지 않아요. 보완 요청을 받으면 다시 고쳐서 낼 수 있어요.')
      } else {
        panel.body = <PlanBoard plan={plan} picks={data.picks} onChanged={refresh} />
        if (application?.approval?.status === 'APPROVED') panel.warn = '학과(부)장 승인을 받은 뒤 지망을 바꾸면 승인이 풀려요(다시 요청). 바꾼 뒤 지원서 화면에서 승인을 다시 받아 주세요.'
        if (application?.status === 'FIX_REQUESTED') panel.notes.push('보완 요청 중이에요. 처음 낸 지망은 낸 날 기준으로 보고, 새로 넣은 지망은 오늘 기준으로 마감을 봐요.')
        panel.action = { to: '/apply', label: '지원서 쓰러 가기' }
      }
    } else if (code === 'APPLY') {
      if (!submitted) {
        const a = app37.data
        if (application?.status === 'FIX_REQUESTED') panel.warn = `센터가 보완을 요청했어요 — ${application.fixReason ?? ''} 고쳐서 다시 내면 접수번호(${application.receiptNo})는 그대로예요.`
        if (app37.loading && !a) panel.body = <Loading text="지원서 칸을 확인하는 중…" />
        else if (app37.error) panel.body = <ErrorBox error={app37.error} retry={app37.reload} />
        const HINT = { PROFILE: '저장한 프로필(학과 · 학년 · 평점)로 학적을 채워요', PICKS: '1지망은 꼭 · 지원 불가 · 마감 직무는 빼요', APPLICANT: '성명(한 · 영) · 생년월일 · 성별 · 연락처 · 주소 · 학번', PLEDGE: '참여 서약', ESSAYS: '지원동기 · 성격 · 경력 · 기타, 문항마다 300자 이상', CONSENTS: '수집 · 이용 / 제3자 제공', SIGNATURE: '본인 서명 2자 이상', APPROVAL: '승인을 받아야 낼 수 있어요' }
        panel.items = (a?.checklist ?? []).map((c) => {
          const approval = c.item === 'APPROVAL'
          const badge = approval && !c.done ? [L('approvalStatus', a.approval?.status ?? 'NONE'), a.approval?.status === 'REQUESTED' ? 'orange' : a.approval?.status === 'STALE' ? 'orange' : 'gray'] : c.done ? ['완료', 'green'] : ['남음', 'orange']
          const actions = c.done ? [] : c.item === 'PROFILE' ? [{ to: '/me', label: '프로필' }] : c.item === 'PICKS' ? [{ onClick: () => setSel(stages.findIndex((x) => x.code === 'PICK')), label: '지망 정하기' }] : [{ to: '/apply', label: approval ? '요청' : '쓰기' }]
          return { title: L('applicationItem', c.item), sub: HINT[c.item], badge, actions }
        })
        if (a) panel.items.push({ title: '진로취업상담', sub: '이수하면 매칭 · 선발 가점이에요 · 재학 중 최대 5회', badge: [`${a.counselCount ?? 0}회`, a.counselCount ? 'green' : 'gray'] })
        if (a?.period) panel.notes.push(`신청 기간 ${fmtDate(a.period.startsOn)} ~ ${fmtDate(a.period.endsOn)}${a.period.open ? '' : ' · 지금은 기간 밖이라 낼 수 없어요(보완 요청을 받아 다시 내는 것은 돼요)'}`)
        panel.action = { to: '/apply', label: application ? '지원서 이어서 쓰기' : '지원서 쓰기' }
      } else {
        panel.items = [
          { title: '지원서', sub: `${fmtDate(application.submittedAt)} 냄 · 접수번호 ${application.receiptNo}`, badge: [L('applicationStatus', application.status), application.status === 'SUBMITTED' ? 'blue' : 'green'], virtual, actions: [{ to: '/apply', label: '보기' }] },
          { title: '학과(부)장 승인', sub: application.approval?.approvedAt ? `${fmtDate(application.approval.approvedAt)} 승인` : '', badge: [L('approvalStatus', application.approval?.status), application.approval?.status === 'APPROVED' ? 'green' : 'orange'], virtual },
          { title: '진로취업상담', sub: '이수하면 매칭 · 선발 가점이에요 · 재학 중 최대 5회', badge: [`${application.counselCount ?? 0}회`, application.counselCount ? 'green' : 'gray'] },
        ]
      }
    } else if (code === 'MATCH') {
      panel.items = [placement
        ? { title: '매칭 결과', sub: `${placement.rank}지망 · ${placement.institution?.name} ${placement.title}`, badge: [`${md(placement.matchedAt)} 매칭`, 'blue'], virtual, actions: [{ to: `/jobs/${placement.jobId}`, label: '직무 보기' }] }
        : { title: '매칭 결과', sub: submitted ? `${md(s.endsOn)}까지 센터가 정해요 · 확정되면 이 화면에 바로 보여요` : '지원서를 내야 매칭 대상이 돼요', badge: ['예정', 'gray'] }]
      panel.notes.push('센터가 매칭 · 선발 화면에서 확정하면 이 화면에 바로 바뀌어요. 메일 · 문자 알림은 보내지 않아요.')
    } else if (code === 'SELECT') {
      const iv = placement?.interview
      panel.items.push(iv?.at
        ? { title: '면접', sub: `${fmtDateTime(iv.at)} · ${L('interviewMode', iv.mode)}`, badge: [L('interviewMode', iv.mode), 'blue'], virtual }
        : { title: '면접 일정', sub: '기관이 정하면 센터가 넣어 여기 보여요', badge: ['예정', 'gray'] })
      panel.items.push(placement?.result
        ? { title: '최종 선발', sub: `${placement.institution?.name} ${placement.title}${placement.team ? ` · ${placement.team}` : ''}`, badge: [`${md(placement.notifiedAt)} ${L('selectionResult', placement.result)}`, placement.result === 'PASS' ? 'green' : 'gray'], virtual }
        : { title: '최종 선발', sub: `${md(s.endsOn)}까지 결과를 알려 드려요`, badge: ['예정', 'gray'] })
      const jobId = placement?.jobId
      if (!placement?.result && jobId) panel.items.push({ title: '면접 준비', sub: '직무 상세의 같은 팀 선배 수기 · 진로취업상담의 면접 상담', badge: ['준비', 'gray'], actions: [{ to: `/jobs/${jobId}`, label: '선배 수기' }] })
      if (placement?.result === 'FAIL') panel.warn = '2026-2는 2차 모집이 없어요. 진로취업상담에서 다음 학기 일정을 안내받을 수 있어요.'
      panel.notes.push('기관 계정은 없어요. 기관이 알려 준 일정과 결과를 센터가 넣으면 여기 반영돼요.')
    } else if (code === 'CONTRACT') {
      panel.items = [
        { title: '3자 협약서 확인 · 서명', sub: '대학 · 기관 · 학생', badge: stateBadge(s), actions: [{ onClick: () => setSheet('contract'), label: sheetLabel(s) }] },
        { title: '수강신청 정정', sub: '정정 기간에 내가 신청한 과목을 직접 지우면, 센터가 현장실습 교과목을 일괄 신청해요', badge: stateBadge(s) },
      ]
      panel.notes.push('협약서 · 보험은 서식과 상태만 보여 줘요(시연). 실습지원비 계좌는 이 서비스에서 받지 않아요.')
    } else if (code === 'ORIENTATION') {
      panel.items = [{ title: '사전교육 참석', sub: `${fmtDate(s.startsOn, true)} · 필수교육 · 학점인정 안내 · 성희롱예방교육`, badge: stateBadge(s) }]
    } else if (code === 'PRACTICE') {
      if (practice) {
        panel.items.push({ title: '진행', sub: `${practice.days}일 중 ${practice.day}일째`, badge: [`${practice.week} / ${practice.weeks}주`, 'blue'] })
        const mid = stageOf('MIDCHECK')
        if (mid && mid.state !== 'DONE') panel.items.push({ title: '다음 할 일 · 중간점검서', sub: `${fmtDate(mid.startsOn, true)} ~ ${fmtDate(mid.endsOn, true)}`, badge: next?.code === 'MIDCHECK' ? [`D-${next.days}`, 'orange'] : stateBadge(mid), actions: [{ onClick: () => setSheet('midcheck'), label: sheetLabel(mid) }] })
        if (practice.currentPlan) panel.items.push({ title: `이번 주 계획 · ${practice.currentPlan.weeks}`, sub: practice.currentPlan.content, badge: ['운영계획서', 'gray'] })
        if (practice.nextPlan) panel.items.push({ title: `다음 계획 · ${practice.nextPlan.weeks}`, sub: practice.nextPlan.content, badge: ['운영계획서', 'gray'] })
      } else {
        panel.items = [{ title: '실습 기간', sub: `${md(s.startsOn)} ~ ${md(s.endsOn)} · 선발되면 기관 · 직무가 여기 보여요`, badge: stateBadge(s) }]
      }
    } else if (code === 'MIDCHECK') {
      panel.items = [{ title: '중간점검서 쓰기', sub: `${fmtDate(s.startsOn, true)} ~ ${fmtDate(s.endsOn, true)}`, badge: next?.code === 'MIDCHECK' ? [`D-${next.days}`, 'orange'] : stateBadge(s), actions: [{ onClick: () => setSheet('midcheck'), label: sheetLabel(s) }] }]
      panel.notes.push('중간점검서는 서식과 상태만 보여 줘요(시연). 실제 제출은 센터 안내에 따라요.')
    } else if (code === 'CLOSE') {
      if (!documents) {
        panel.items = ['REPORT', 'CREDIT', 'SURVEY'].map((k) => ({ title: L('studentDocument', k), sub: '합격을 알린 뒤에 서류 칸이 열려요', badge: ['예정', 'gray'] }))
      } else {
        const d = documents
        const reportActions = d.report ? [{ to: '/career', label: '리포트 보기' }] : d.careerReportId ? [{ onClick: () => askMark('REPORT'), label: '냄 표시', real: true, busy: docBusy === 'REPORT' }] : [{ to: '/career', label: '리포트 만들기', real: true }]
        panel.items = [
          { title: L('studentDocument', 'REPORT'), sub: "'실습 내용' 칸은 커리어 리포트로 정리해요 · 리포트가 있어야 냄 표시를 할 수 있어요", badge: d.report ? [`${md(d.report)} 냄`, 'green'] : d.careerReportId ? ['리포트 있음', 'blue'] : ['리포트 먼저', 'orange'], actions: reportActions },
          ...['CREDIT', 'SURVEY'].map((k) => {
            const at = d[k.toLowerCase()]
            return { title: L('studentDocument', k), sub: '서식은 미리 보기 · 원본은 후기 간담회 때 내요', badge: at ? [`${md(at)} 냄`, 'green'] : ['내기 전', 'orange'], actions: [{ onClick: () => setSheet('credit'), label: '서식' }, ...(at ? [] : [{ onClick: () => askMark(k), label: '냄 표시', real: true, busy: docBusy === k }])] }
          }),
          { title: `${L('closeItem', 'EVALUATION')} · ${L('closeItem', 'ATTENDANCE')}`, sub: `기관이 메일로 보내면 센터가 받음 표시를 해요 · 평가표 ${d.evaluation ? `${md(d.evaluation)} 도착` : '아직'} · 출근부 ${d.attendance ? `${md(d.attendance)} 도착` : '아직'}`, badge: d.evaluation && d.attendance ? ['도착', 'green'] : ['기관', 'gray'] },
          { title: `${L('closeItem', 'APPROVAL')} · 학점 인정`, sub: '센터가 평가표 · 출근부를 모두 받으면 승인 링크가 생겨요', badge: [L('approvalStatus', d.creditApproval?.status ?? 'NONE'), d.creditApproval?.status === 'APPROVED' ? 'green' : d.creditApproval?.status === 'NONE' ? 'gray' : 'orange'] },
        ]
        if (d.remindedAt) panel.warn = `센터가 ${fmtDateTime(d.remindedAt)}에 안 낸 서류를 알려 줬어요.`
        panel.notes.push('냄 표시만 하고 파일은 받지 않아요. 원본 서류는 후기 간담회 때 내요.')
      }
    } else if (code === 'DEBRIEF') {
      panel.items = [{ title: '후기 간담회 참석', sub: `${fmtDate(s.startsOn, true)} · 원본 서류 제출`, badge: stateBadge(s) }]
      if (documents) {
        const missing = ['REPORT', 'CREDIT', 'SURVEY'].filter((k) => !documents[k.toLowerCase()])
        panel.items.push(missing.length
          ? { title: '아직 안 낸 학생 서류', sub: missing.map((k) => L('studentDocument', k)).join(' · '), badge: [`${missing.length}개`, 'orange'], actions: [{ onClick: () => setSel(stages.findIndex((x) => x.code === 'CLOSE')), label: '종료 · 제출 보기', real: true }] }
          : { title: '학생 서류', sub: '수행결과보고서 · 학점인정신청서 · 설문조사서', badge: ['모두 냄', 'green'] })
      }
    } else if (code === 'CREDIT') {
      panel.items = [
        { title: '학점', sub: `${practice ? `${practice.courseName} ${practice.credits}학점` : '현장실습 교과목'} · P/NP라 평점에는 들어가지 않아요`, badge: stateBadge(s) },
        ...(documents ? [{ title: '학과(부)장 승인', sub: '학점 인정 승인', badge: [L('approvalStatus', documents.creditApproval?.status ?? 'NONE'), documents.creditApproval?.status === 'APPROVED' ? 'green' : 'gray'] }] : []),
        { title: '대학 장학금', sub: '월 20만 원 × 최대 3개월 · 학점 인정 뒤 일괄', badge: stateBadge(s) },
        { title: '커리어 리포트', sub: '보고서에서 찾은 능력단위 · 넓혀 갈 직무 · 이어지는 직업', badge: documents?.careerReportId ? ['있음', 'green'] : ['만들기 전', 'gray'], actions: [{ to: '/career', label: documents?.careerReportId ? '보기' : '만들기', real: !documents?.careerReportId }] },
      ]
    }
    if (!s.confirmed) panel.notes.push('이 단계 날짜는 학생 모집안내에 없어 센터 확인 전이에요.')
  }
  const [title, desc] = STAGE_TEXT[s?.code] ?? [L('stage', s?.code), '']
  const stageTitle = s?.code === 'PRACTICE' && practice ? `실습 · ${practice.weeks}주` : title
  const stageDesc = s?.code === 'PRACTICE' && practice
    ? `${placement.institution?.name} ${placement.title} · ${weekdayText(codes, practice.weekdays)} ${practice.workHours ?? ''} · 주 ${Number(practice.weeklyHours)}시간 · 실습지원비 ${stipendText(practice.stipend)} · ${practice.courseName} ${practice.credits}학점`
    : desc

  return <main className="fx-page"><div className="fx-shell">
    {virtual && <div className="fx-demo" style={{ marginBottom: 16 }}><b>체험</b><span>체험 계정이 갖고 시작한 지난 기록(지원서 · 매칭 · 면접{documents?.evaluation ? ' · 마무리 서류 일부' : ''})은 가상이에요</span><span>기준일 {fmtDate(data.asOf, true)}</span></div>}

    <div className="mi-head">
      <header className="page-title"><span>MY INTERNSHIP · {data.round?.termCode} 표준 현장실습학기제</span><h1>{headTitle}</h1><p>{headSub}</p></header>
      {next && <div className="mi-day"><small>{dayLabel}</small><span className="v2-dday">{dday}</span></div>}
    </div>

    <section className="mi-track" aria-label="현장실습 타임라인">
      <div className="mi-phases" style={{ gridTemplateColumns: phases.map((p) => `${p.n}fr`).join(' ') }}>{phases.map((p) => <span key={p.code} className={p.code === nowPhase ? 'on' : ''}>{L('stagePhase', p.code)}</span>)}</div>
      <ol className="mi-nodes" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>{stages.map((x, i) => <li key={x.code} className={x.state === 'DONE' ? 'done' : x.state === 'NOW' ? 'now' : ''}>
        <button type="button" className={`mi-node ${i === selIndex ? 'sel' : ''}`} aria-pressed={i === selIndex} onClick={() => { setSel(i); setDocError('') }}><i>{x.state === 'DONE' ? '✓' : x.state === 'NOW' ? '●' : ''}</i><b>{L('stage', x.code)}</b><small>{when(x)}</small></button>
      </li>)}</ol>
      <p className="mi-hint">단계를 누르면 그때 챙길 것을 아래에 보여 줘요 · 일정은 {data.round?.termCode} 학생 모집안내 기준이고 기관마다 달라질 수 있어요</p>
    </section>

    {s && <div className="fx-split mi-panel">
      <section className="fx-card">
        <div className="mi-stage-head"><div><span className="fx-kicker">{when(s) || '일정 확인 전'}{s.confirmed ? '' : ' · 센터 확인 전'}</span><h2>{stageTitle}</h2><p>{stageDesc}</p></div><span className={`badge ${STATE_TONE[s.state]}`}>{L('stageState', s.state)}</span></div>
        {panel.warn && <div className="fx-callout warn mi-note"><span className="fx-callout-icon">!</span><span>{panel.warn}</span></div>}
        {panel.body}
        {panel.items.length > 0 && <div className="mi-items">{panel.items.map((it) => <Item key={it.title} item={it} />)}</div>}
        {docError && <p className="mi-error" role="alert">{docError === 'REPORT' ? <>수행결과보고서를 내려면 실습한 자리의 커리어 리포트가 먼저 있어야 해요. <Link to="/career">커리어 리포트 만들기 →</Link></> : docError}</p>}
        {panel.notes.map((n) => <div key={n} className="fx-callout mi-note"><span className="fx-callout-icon">i</span><span>{n}</span></div>)}
        {panel.action && <div className="mi-actions"><Link className="fx-btn primary" to={panel.action.to}>{panel.action.label}</Link></div>}
      </section>
      <aside className="fx-aside">
        {s.code === 'PICK' && !submitted && <ExploreSide planItems={plan.data?.items} />}
        {placement && <section className="fx-card tight mi-side"><h3>내 실습 자리{virtual && <VirtualTag />}</h3>
          <div className="mi-place"><InstitutionLogo institution={placement.institution} className="plan-institution-logo" /><div><small>{placement.institution?.name}{placement.team ? ` · ${placement.team}` : ''}</small><b>{placement.title}</b></div></div>
          <p>{placement.rank}지망 매칭{placement.result ? ` · ${L('selectionResult', placement.result)}` : ''}{practice ? ` · ${md(practice.startsOn)} ~ ${md(practice.endsOn)}` : ''}</p>
          <Link className="v2-link" style={{ marginTop: 10, fontSize: 12 }} to={`/jobs/${placement.jobId}`}>직무 상세 →</Link></section>}
        {placement?.result === 'PASS' && <section className="fx-card tight mi-side"><h3>커리어 리포트</h3><p>수행결과보고서의 '실습 내용'을 붙여 넣으면 다룬 NCS 능력단위와 넓혀 갈 직무를 정리해 줘요.</p><Link className="v2-link" style={{ marginTop: 10, fontSize: 12 }} to="/career">{documents?.careerReportId ? '리포트 보기' : '리포트 만들기'} →</Link></section>}
        <section className="fx-card tight mi-side"><h3>문의</h3><p>현장실습지원센터 · 02-940-2948 · internship@skuniv.ac.kr</p></section>
      </aside>
    </div>}

    {sheet && <FormSheet kind={sheet} data={data} codes={codes} close={() => setSheet(null)} />}
    {confirm && <Modal close={() => setConfirm(null)} className="mi-confirm">{(dismiss) => <>
      <h2>{L('studentDocument', confirm)}를 냈다고 표시할까요?</h2>
      <p>파일은 받지 않고 냄 표시만 해요. 원본 서류는 후기 간담회 때 내요.{confirm === 'REPORT' ? ' 보고서의 실습 내용은 커리어 리포트로 정리한 글을 써요.' : ''}</p>
      <div className="fx-row"><button type="button" className="fx-btn" onClick={dismiss}>취소</button><button type="button" className="fx-btn primary" onClick={() => { dismiss(); mark(confirm) }}>냄 표시</button></div>
    </>}</Modal>}
  </div></main>
}
