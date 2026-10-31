import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { approvalUrl, deleteMyApplication, getMyApplication, requestApproval, saveMyApplication, submitMyApplication } from '../../api/application'
import { errorMessage, getToken } from '../../api/client'
import { label } from '../../api/reference'
import { ErrorBox, Loading, NeedLogin, VerdictBadge, VirtualTag } from '../../components/v2'
import { Modal } from '../../components/Shell'
import { TimelineRunner } from '../../components/TimelineRunner'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDate, fmtDateTime, studentAppStatus } from '../../lib/format'
import './Apply.css'

// 지원서(별지 제5호) — #37 보기 · #38 임시 저장 · #39 지우기 · #40 승인 링크 · #41 내기
// 저장 전 입력값은 이 화면 상태로만 들고 있다(localStorage 금지, AGENTS.md).

const TABS = ['신청서', '이력서', '자기소개서', '동의서', '서명 · 승인']
const LOCKED = ['SUBMITTED', 'RECEIVED', 'MATCHED']
const ESSAY_MIN = 300
// 별지 제5호 자기소개서 4문항(서식 문항 요약)
const ESSAYS = [
  ['지원동기', '지원한 동기와 실습을 통해 얻고자 하는 것'],
  ['성격 및 장단점', '장단점과 단점을 극복하려고 노력한 경험'],
  ['경력사항 및 단체활동', '팀 활동에서 본인 역할 · 협력 · 어려움을 넘은 경험'],
  ['기타 자유 기술', '이 직무를 희망하는 이유와 적합한 근거'],
]
const APPLICANT_KEYS = ['nameKo', 'nameEn', 'birthDate', 'gender', 'phone', 'email', 'address', 'studentNo', 'minorMajor']
const APPLICANT_REQUIRED = ['nameKo', 'nameEn', 'birthDate', 'gender', 'phone', 'address', 'studentNo']
const RESUME = {
  certificates: { keys: ['name', 'issuer', 'acquiredOn'], head: ['구분', '자격 · 교육명', '발급 · 교육기관', '취득일'], holder: ['예: 컴퓨터활용능력 2급', '예: 대한상공회의소', '2025-08'] },
  awards: { keys: ['name', 'issuer', 'awardedOn', 'detail'], head: ['수상명', '수여 기관', '수상일', '내용'], holder: ['예: 졸업작품전 우수상', '수여 기관', '2025-11', '한 줄 설명'] },
  careers: { keys: ['period', 'company', 'role', 'note'], head: ['기간', '회사', '부서 · 직위', '비고'], holder: ['2025.03 ~ 2025.10', '회사 이름', '예: 판매 아르바이트', '비고'] },
}
const RESUME_MAX = 10
const emptyResumeRow = (group) => ({ ...(group === 'certificates' ? { kind: 'CERTIFICATE' } : {}), ...Object.fromEntries(RESUME[group].keys.map((key) => [key, ''])) })
// 항목 코드 → 고칠 탭
const ITEM_TAB = { PROFILE: 0, PICKS: 0, APPLICANT: 0, PLEDGE: 0, ESSAYS: 2, CONSENTS: 3, SIGNATURE: 4, APPROVAL: 4 }
const FIELD_LABEL = { nameKo: '성명(한글)', nameEn: '성명(영문)', birthDate: '생년월일', gender: '성별', phone: '연락처', email: '이메일', address: '현 주소', studentNo: '학번', minorMajor: '부 · 복수전공', signature: '본인 서명', essays: '자기소개서', consents: '동의' }
const STATUS_TONE = { NONE: 'gray', DRAFT: 'gray', SUBMITTED: 'blue', RECEIVED: 'green', FIX_REQUESTED: '', MATCHED: 'green' }

const essayChars = (text) => [...String(text ?? '').trim()].length
const clean = (value) => { const text = String(value ?? '').trim(); return text ? text : null }
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)

// 기관 이름에서 '주식회사'·'(주)'·괄호 안을 뺀 두 글자 이상(백엔드 essayWarnings와 같은 규칙) — 고치는 중인 글에 쓴다
const coreName = (name) => String(name ?? '').replace(/주식회사|\(주\)|㈜|\([^)]*\)/g, ' ').trim().replace(/\s+/g, ' ')

// 응답 → 화면 입력값
function toForm(app) {
  const applicant = Object.fromEntries(APPLICANT_KEYS.map((key) => [key, app.applicant?.[key] ?? '']))
  const rows = (list, keys, extra = {}) => (list ?? []).map((row) => ({ ...Object.fromEntries(Object.entries(extra).map(([k, d]) => [k, row[k] ?? d])), ...Object.fromEntries(keys.map((k) => [k, row[k] ?? ''])) }))
  return {
    applicant,
    resume: {
      certificates: rows(app.resume?.certificates, RESUME.certificates.keys, { kind: 'CERTIFICATE' }),
      awards: rows(app.resume?.awards, RESUME.awards.keys),
      careers: rows(app.resume?.careers, RESUME.careers.keys),
    },
    essays: [0, 1, 2, 3].map((i) => app.essays?.[i] ?? ''),
    pledge: Boolean(app.pledge),
    // 저장 전(NONE)에는 예·아니요 어느 쪽도 고르지 않은 상태로 둔다
    consents: app.status === 'NONE' ? { collect: null, thirdParty: null } : { collect: Boolean(app.consents?.collect), thirdParty: Boolean(app.consents?.thirdParty) },
    signature: app.signature ?? '',
  }
}

// 화면 입력값 → #38 본문. 빈 줄(모든 칸이 빈 이력서 줄)은 보내지 않는다
function toBody(form) {
  const rows = (list, keys, kind) => list.filter((row) => keys.some((k) => clean(row[k]))).map((row) => ({ ...(kind ? { kind: row.kind || 'CERTIFICATE' } : {}), ...Object.fromEntries(keys.map((k) => [k, clean(row[k])])) }))
  return {
    applicant: Object.fromEntries(APPLICANT_KEYS.map((key) => [key, clean(form.applicant[key])])),
    resume: {
      certificates: rows(form.resume.certificates, RESUME.certificates.keys, true),
      awards: rows(form.resume.awards, RESUME.awards.keys),
      careers: rows(form.resume.careers, RESUME.careers.keys),
    },
    essays: form.essays.map((text) => String(text ?? '').trim()),
    pledge: Boolean(form.pledge),
    consents: { collect: form.consents.collect === true, thirdParty: form.consents.thirdParty === true },
    signature: clean(form.signature),
  }
}

const sameBody = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const draftTabKey = (id) => `application-draft-tab:${id}`
const initialDraftTab = (app) => {
  if (app.status !== 'DRAFT') return 0
  let savedTab = null
  try { if (app.applicationId != null) savedTab = localStorage.getItem(draftTabKey(app.applicationId)) } catch { /* 남은 항목부터 시작한다. */ }
  const index = savedTab === null ? -1 : Number(savedTab)
  if (Number.isInteger(index) && index >= 0 && index < TABS.length) return index
  const next = (app.checklist ?? []).find((item) => !item.done && item.item in ITEM_TAB)
  return next ? ITEM_TAB[next.item] : 0
}

// 본인 서명은 신청서의 성명(한글)과 같아야 낼 수 있다(공백은 보지 않음, 2자 이상 — 백엔드 ADR-0042와 같은 규칙)
const noSpace = (value) => String(value ?? '').replace(/\s+/g, '')
const signedAsApplicant = (signature, nameKo) => { const sign = noSpace(signature); return [...sign].length >= 2 && sign === noSpace(nameKo) }

export function ApplyPage() {
  const loggedIn = Boolean(getToken())
  const app = useRequest(getMyApplication, loggedIn)
  const codes = useCodes()
  const [tab, setTab] = useState(null)
  const [notice, setNotice] = useState(null)
  const [missing, setMissing] = useState([])
  const [formVersion, setFormVersion] = useState(0)

  if (!loggedIn) return <NeedLogin />
  if (!app.data) {
    return <main className="fx-page ap-page"><div className="fx-shell">
      <Link className="ap-back-fixed" to="/internship" state={{ internshipStage: 'APPLY' }} aria-label="내 현장실습으로 돌아가기">← 뒤로가기</Link>
      {app.error ? <ErrorBox error={app.error} fallback="지원서를 불러오지 못했어요." retry={app.reload} /> : <Loading text="지원서를 불러오는 중…" note="서버가 잠들어 있으면 첫 요청이 1분 가까이 걸려요." />}
    </div></main>
  }

  // 저장·내기·지우기 응답으로 바꾸고 입력값도 그 응답으로 다시 채운다
  const applyResponse = (data) => { app.mutate(data); setFormVersion((v) => v + 1) }
  const resetAfterDelete = () => { app.mutate(null); app.reload(); setFormVersion((v) => v + 1) }

  return <Editor
    key={`${app.data.applicationId ?? 'new'}#${formVersion}`}
    app={app.data}
    refreshing={app.loading}
    reload={app.reload}
    applyResponse={applyResponse}
    resetAfterDelete={resetAfterDelete}
    codes={codes}
    tab={tab ?? initialDraftTab(app.data)} setTab={setTab}
    notice={notice} setNotice={setNotice}
    missing={missing} setMissing={setMissing}
  />
}

function Editor({ app, refreshing, reload, applyResponse, resetAfterDelete, codes, tab, setTab, notice, setNotice, missing, setMissing }) {
  const [form, setForm] = useState(() => toForm(app))
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [leaveError, setLeaveError] = useState('')
  const [copied, setCopied] = useState(false)

  const locked = LOCKED.includes(app.status)
  const fixing = app.status === 'FIX_REQUESTED'
  const body = toBody(form)
  const dirty = !locked && !sameBody(body, toBody(toForm(app)))
  const blocker = useBlocker(dirty)
  const approval = app.approval ?? { status: 'NONE' }
  const picks = app.picks ?? []
  const pickNames = picks.map((p) => coreName(p.institution?.name)).filter((n) => n.length >= 2)

  // 다른 탭에서 승인을 누르고 돌아오면 승인 상태를 다시 본다(입력값은 그대로)
  useEffect(() => {
    if (locked || !approval.token) return undefined
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [locked, approval.token, reload])

  // 새로 고친 응답에서 승인됐으면 알린다
  const seenApproval = useRef(approval.status)
  useEffect(() => {
    if (seenApproval.current !== approval.status && approval.status === 'APPROVED') setNotice({ tone: 'ok', text: '학과(부)장이 승인했어요. 이제 지원서를 낼 수 있어요.' })
    seenApproval.current = approval.status
  }, [approval.status, setNotice])

  // 저장하지 않은 변경이 있으면 떠나기 전에 묻는다
  useEffect(() => {
    if (!dirty) return undefined
    const onLeave = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [dirty])

  // ── 입력 ──
  const setApplicant = (key) => (event) => setForm((f) => ({ ...f, applicant: { ...f.applicant, [key]: event.target.value } }))
  const setGender = (gender) => setForm((f) => ({ ...f, applicant: { ...f.applicant, gender } }))
  const setRow = (group, index, key, value) => setForm((f) => ({ ...f, resume: { ...f.resume, [group]: f.resume[group].map((row, i) => (i === index ? { ...row, [key]: value } : row)) } }))
  const addRow = (group) => setForm((f) => ({ ...f, resume: { ...f.resume, [group]: [...f.resume[group], emptyResumeRow(group)] } }))
  const removeRow = (group, index) => setForm((f) => ({ ...f, resume: { ...f.resume, [group]: f.resume[group].filter((_, i) => i !== index) } }))
  const setEssay = (index) => (event) => setForm((f) => ({ ...f, essays: f.essays.map((text, i) => (i === index ? event.target.value : text)) }))
  const setConsent = (key, value) => setForm((f) => ({ ...f, consents: { ...f.consents, [key]: value } }))

  // ── 요청 ──
  const fail = (error, action) => {
    if (error.code === 'CONSENT_REQUIRED') {
      setTab(3)
      return setNotice({ tone: 'error', text: '개인정보 수집 · 이용에 동의해야 저장돼요. 동의서 탭에서 \'예\'를 골라 주세요.' })
    }
    if (error.code === 'INVALID_INPUT') {
      const errors = Object.fromEntries((error.fields ?? []).map((f) => [f.field, f.reason]))
      setFieldErrors(errors)
      const first = Object.keys(errors)[0] ?? ''
      setTab(first.startsWith('resume') ? 1 : first.startsWith('essays') ? 2 : first.startsWith('consents') ? 3 : first.startsWith('signature') ? 4 : 0)
      return setNotice({ tone: 'error', text: '입력값을 확인해 주세요.', list: (error.fields ?? []).map((f) => `${fieldLabel(f.field)} — ${f.reason}`) })
    }
    if (error.code === 'APPLICATION_INCOMPLETE') {
      const items = (error.fields ?? []).map((f) => f.field)
      setMissing(items)
      if (items.some((item) => item in ITEM_TAB)) setTab(ITEM_TAB[items.find((item) => item in ITEM_TAB)])
      return setNotice({ tone: 'error', text: '아직 채우지 않은 것이 있어 낼 수 없어요.', list: (error.fields ?? []).map((f) => `${label(codes, 'applicationItem', f.field)} — ${f.reason}`) })
    }
    if (error.code === 'APPLICATION_CLOSED') return setNotice({ tone: 'error', text: `${error.message}. 신청 기간 안에만 낼 수 있어요.` })
    if (error.code === 'PROFILE_NOT_FOUND') return setNotice({ tone: 'error', text: error.message, link: ['/profile', '프로필 저장하러 가기 →'] })
    if (error.code === 'APPLICATION_LOCKED' || error.code === 'STATE_CONFLICT') {
      reload()
      return setNotice({ tone: 'error', text: `${error.message}. 지원서를 다시 불러왔어요.` })
    }
    if (error.code === 'APPLICATION_NOT_FOUND') return setNotice({ tone: 'error', text: '저장한 지원서가 없어요. 먼저 임시 저장해 주세요.' })
    setNotice({ tone: 'error', text: errorMessage(error, `${action} 못했어요. 잠시 뒤 다시 시도해 주세요.`) })
  }

  const run = async (kind, task) => {
    setBusy(kind); setNotice(null); setMissing([]); setFieldErrors({})
    try { await task() } finally { setBusy(null) }
  }

  // 바뀐 게 있거나 아직 한 번도 저장하지 않았으면 먼저 저장한다(승인 링크·내기는 저장한 내용 기준)
  const saveIfNeeded = async () => {
    if (!dirty && app.status !== 'NONE') return app
    const saved = await saveMyApplication(body)
    try { return await getMyApplication() } catch { return saved }
  }

  const save = () => run('save', async () => {
    try {
      const data = await saveIfNeeded()
      try { if (data.applicationId != null) localStorage.setItem(draftTabKey(data.applicationId), String(tab)) } catch { /* 지원서 저장은 위치 저장과 별개다. */ }
      applyResponse(data)
      setNotice({ tone: 'ok', text: approval.status === 'APPROVED' && data.approval?.status === 'STALE' ? '임시 저장했어요. 승인 뒤 내용이 바뀌어 학과(부)장 승인을 다시 받아야 해요.' : '임시 저장했어요.' })
    } catch (error) { fail(error, '저장하지') }
  })

  const nextTab = () => run('next', async () => {
    const next = tab + 1
    try {
      if (!locked) {
        if (!form.consents.collect && (dirty || app.status === 'NONE')) {
          setNotice({ tone: 'info', text: '개인정보 수집 · 이용에 동의하면 작성한 내용을 임시 저장할 수 있어요. 그전까지 입력 내용은 이 화면에 유지돼요.' })
        } else {
          const saved = await saveIfNeeded()
          try { if (saved.applicationId != null) localStorage.setItem(draftTabKey(saved.applicationId), String(next)) } catch { /* 저장 위치를 기록하지 못해도 지원서는 저장된다. */ }
          if (saved !== app) applyResponse(saved)
        }
      }
      setTab(next)
      const tabs = document.querySelector('.ap-page .fx-tabs')
      if (tabs) window.scrollTo({ top: Math.max(0, window.scrollY + tabs.getBoundingClientRect().top - 100), behavior: 'smooth' })
    } catch (error) { fail(error, '저장하지') }
  })

  const saveAndLeave = async () => {
    setBusy('leave'); setLeaveError('')
    try {
      await saveIfNeeded()
      blocker.proceed()
    } catch (error) {
      if (error.code === 'CONSENT_REQUIRED') {
        blocker.reset()
        fail(error, '저장하지')
      } else setLeaveError(errorMessage(error, '저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요.'))
    } finally { setBusy(null) }
  }

  const makeLink = () => run('link', async () => {
    let saved = null
    try { saved = await saveIfNeeded() } catch (error) { return fail(error, '저장하지') }
    try {
      const data = await requestApproval()
      applyResponse(data)
      setTab(4)
      setNotice({ tone: 'ok', text: '승인 링크를 만들었어요. 링크를 학과 사무실에 전해 주세요.' })
    } catch (error) {
      if (saved !== app) applyResponse(saved)
      fail(error, '링크를 만들지')
    }
  })

  const submit = () => run('submit', async () => {
    let saved = null
    try { saved = await saveIfNeeded() } catch (error) { return fail(error, '저장하지') }
    try {
      const data = await submitMyApplication()
      applyResponse(data)
      if (fixing) setNotice({ tone: 'ok', text: '고친 지원서를 다시 냈어요. 접수번호는 그대로예요.' })
    } catch (error) {
      if (saved !== app) applyResponse(saved)
      fail(error, '내지')
    }
  })

  const remove = () => run('delete', async () => {
    try {
      await deleteMyApplication()
      try { if (app.applicationId != null) localStorage.removeItem(draftTabKey(app.applicationId)) } catch { /* 저장된 위치가 없어도 지원서는 지운다. */ }
      setTab(0)
      resetAfterDelete()
      setNotice({ tone: 'ok', text: '지원서를 지웠어요. 담은 지망과 프로필은 그대로예요.' })
    } catch (error) { fail(error, '지우지') }
  })

  const copyLink = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000) } catch { setNotice({ tone: 'info', text: '복사하지 못했어요. 링크 칸을 눌러 직접 복사해 주세요.' }) }
  }

  // ── 표시 값 ──
  const leftApplicant = APPLICANT_REQUIRED.filter((key) => !clean(form.applicant[key])).length + (form.pledge ? 0 : 1)
  const essayDone = form.essays.filter((text) => essayChars(text) >= ESSAY_MIN).length
  const consentDone = form.consents.collect === true && form.consents.thirdParty === true
  const signed = signedAsApplicant(form.signature, form.applicant.nameKo)
  const badge = (ok, text) => ({ text, cls: ok ? 'ok' : 'todo' })
  const tabBadges = locked
    ? TABS.map((_, i) => (i === 1 ? { text: '선택', cls: 'opt' } : badge(true, '완료')))
    : [
      badge(leftApplicant === 0, leftApplicant === 0 ? '완료' : `${leftApplicant}칸`),
      { text: '선택', cls: 'opt' },
      badge(essayDone === 4, `${essayDone}/4`),
      badge(consentDone, consentDone ? '완료' : '남음'),
      badge(signed && approval.status === 'APPROVED', signed && approval.status === 'APPROVED' ? '완료' : approval.status === 'REQUESTED' ? '대기' : '남음'),
    ]

  const checklist = app.checklist ?? []
  const doneCount = checklist.filter((c) => c.done).length
  const submitBlockers = [
    ...(!dirty ? [] : ['변경한 내용 임시 저장']),
    ...checklist.filter((c) => !c.done && c.item !== 'APPROVAL').map((c) => label(codes, 'applicationItem', c.item)),
    ...(approval.status === 'APPROVED' ? [] : [approval.status === 'STALE' ? '학과(부)장 재승인' : '학과(부)장 승인']),
    ...(!app.period?.open && !fixing ? ['지원서 신청 기간 확인'] : []),
  ].filter((item, index, items) => items.indexOf(item) === index)

  return <main className="fx-page ap-page"><div className="fx-shell">
    <Link className="ap-back-fixed" to="/internship" state={{ internshipStage: 'APPLY' }} aria-label="내 현장실습으로 돌아가기">← 뒤로가기</Link>

    {fixing && <section className="ap-fix" role="alert">
      <span>센터 보완 요청</span>
      <b>{app.fixReason || '센터가 보완을 요청했어요.'}</b>
      <p>고쳐서 다시 내면 같은 접수번호({app.receiptNo})로 다시 접수돼요. 신청 기간이 끝났어도 낼 수 있어요. 내용을 바꾸면 학과(부)장 승인도 다시 받아야 해요.</p>
    </section>}

    <section className="fx-hero ap-hero">
      <div>
        <span className="fx-kicker">Application · 별지 제5호 서식</span>
        <h1 className="fx-h1">{app.round?.termCode} 현장실습 지원서<VirtualTag show={app.virtual} /></h1>
        <p className="fx-lead">{app.status === 'MATCHED' ? '낸 지원서예요. 매칭이 확정돼 더는 고칠 수 없어요.' : locked ? '낸 지원서예요. 센터가 보완을 요청하면 여기서 고쳐서 다시 내요.' : fixing ? '보완 요청을 받은 칸을 고친 뒤 승인을 받고 다시 내 주세요.' : '프로필 · 내 지망 값은 미리 채웠어요. 빈칸만 채우면 돼요. 한 부가 1~3지망에 같이 가요.'}</p>
        {app.virtual && <p className="fx-small" style={{ margin: '6px 0 0' }}>체험 계정의 지난 기록(가상)이에요.</p>}
      </div>
      <HeroSide app={app} locked={locked} fixing={fixing} />
    </section>

    <nav className="fx-tabs" aria-label="지원서 단계" style={{ '--ap-progress': `${tab * 20}%` }}>
      {TABS.map((text, i) => {
        const current = tab === i
        const done = tabBadges[i].cls === 'ok'
        return <button key={text} type="button" className={`fx-tab${current ? ' on' : ''}${done ? ' is-done' : ''}`} aria-current={current ? 'step' : undefined} onClick={() => setTab(i)}>
          <span className="ap-tab-node" aria-hidden="true">{current ? <TimelineRunner className="ap-tab-runner" /> : done ? '✓' : ''}</span>
          <span className="ap-tab-copy"><small>STEP {String(i + 1).padStart(2, '0')}</small><span>{text}<i className={tabBadges[i].cls}>{tabBadges[i].text}</i></span></span>
        </button>
      })}
    </nav>

    <div className="fx-split">
      <section className="fx-card ap-form-card"><div className="ap-tab-content" key={tab}>
        {tab === 0 && <>
          <div className="ap-sec"><h3>기본정보</h3><dl className="fx-rows ap-rows">
            {[['nameKo', '성명(한글)', '예: 홍길동'], ['nameEn', '성명(영문)', '예: Hong Gildong']].map(([key, text, holder]) => <FieldRow key={key} label={text} value={form.applicant[key]} onChange={setApplicant(key)} placeholder={holder} readOnly={locked} error={fieldErrors[`applicant.${key}`]} />)}
            <FieldRow label="생년월일" type="date" value={form.applicant.birthDate} onChange={setApplicant('birthDate')} readOnly={locked} display={form.applicant.birthDate ? form.applicant.birthDate.replaceAll('-', '. ') : ''} error={fieldErrors['applicant.birthDate']} />
            <div><dt>성별</dt><dd>{locked ? label(codes, 'gender', form.applicant.gender) || '—' : <div className="fx-seg ap-seg" role="radiogroup" aria-label="성별">{Object.entries(codes?.gender ?? { M: '남', F: '여' }).map(([code, text]) => <button key={code} type="button" role="radio" aria-checked={form.applicant.gender === code} className={form.applicant.gender === code ? 'on' : ''} onClick={() => setGender(code)}>{text}</button>)}</div>}{fieldErrors['applicant.gender'] && <small className="ap-err">{fieldErrors['applicant.gender']}</small>}</dd><span /></div>
            <FieldRow label="연락처" value={form.applicant.phone} onChange={setApplicant('phone')} placeholder="010-0000-0000" inputMode="tel" readOnly={locked} error={fieldErrors['applicant.phone']} />
            <FieldRow label="현 주소" value={form.applicant.address} onChange={setApplicant('address')} placeholder="도로명 주소" readOnly={locked} error={fieldErrors['applicant.address']} />
            <FieldRow label="이메일" value={form.applicant.email} onChange={setApplicant('email')} placeholder="선택 · 연락받을 이메일" inputMode="email" readOnly={locked} error={fieldErrors['applicant.email']} />
          </dl></div>

          <div className="ap-sec"><h3>학적정보</h3><dl className="fx-rows ap-rows">
            {app.academic ? <>
              <div><dt>학과(부)</dt><dd>{app.academic.department?.name}</dd><span className="fx-src blue">{locked ? '낸 날' : '프로필'}</span></div>
              <div><dt>학년 · 학기</dt><dd>{app.academic.grade}학년 · {app.academic.completedSemesters}학기 이수{app.academic.graduationExpected ? ' · 졸업 예정' : ''}</dd><span className="fx-src blue">{locked ? '낸 날' : '프로필'}</span></div>
              <div><dt>평균평점</dt><dd>{app.academic.gpa} / 4.5</dd><span className="fx-src blue">{locked ? '낸 날' : '프로필'}</span></div>
            </> : <div><dt>학과 · 학년</dt><dd><span className="fx-orange">저장한 프로필이 없어요.</span> <Link className="fx-blue" to="/profile">프로필 저장하기 →</Link></dd><span /></div>}
            <FieldRow label="학번" value={form.applicant.studentNo} onChange={setApplicant('studentNo')} placeholder="숫자 10자리" inputMode="numeric" readOnly={locked} error={fieldErrors['applicant.studentNo']} />
            <FieldRow label="부 · 복수전공" value={form.applicant.minorMajor} onChange={setApplicant('minorMajor')} placeholder="없으면 비워 두세요" readOnly={locked} error={fieldErrors['applicant.minorMajor']} />
          </dl></div>

          <div className="ap-sec">
            <div className="fx-row between"><h3>내 지망</h3>{locked && <span className="fx-src blue">낸 날 기준</span>}</div>
            <div className="ap-picks">
              {[1, 2, 3].map((rank) => {
                const pick = picks.find((p) => p.rank === rank)
                if (!pick) return <div key={rank} className={`ap-pick is-empty${rank === 1 ? ' is-need' : ''}`}><b>{rank}지망</b><span>{rank === 1 ? '1지망은 꼭 정해야 해요' : '정하지 않음(선택)'}</span><span /></div>
                return <div key={rank} className="ap-pick"><b>{rank}지망</b><span>{pick.title}<small>{pick.institution?.name}{pick.team ? ` · ${pick.team}` : ''}</small></span><span className="ap-pick-tags">{pick.closed && <span className="badge">마감</span>}<VerdictBadge verdict={pick.verdict} /></span></div>
              })}
            </div>
            <div className="ap-pick-foot">
              {locked && <p className="fx-small" style={{ margin: 0 }}>낸 지망은 바꿀 수 없어요</p>}
              {!locked && <Link className="fx-btn sm" to="/internship?step=pick">지망 바꾸기 →</Link>}
            </div>
          </div>

          <div className="ap-sec">{locked
            ? <p className="fx-sub" style={{ margin: 0 }}>{form.pledge ? '✓ 서약 내용을 읽었고 표준현장실습학기제를 신청했어요.' : '서약하지 않았어요.'}</p>
            : <label className="ap-pledge"><input type="checkbox" checked={form.pledge} onChange={() => setForm((f) => ({ ...f, pledge: !f.pledge }))} /> 서약 내용을 읽었고 표준현장실습학기제를 신청합니다</label>}
          </div>
        </>}

        {tab === 1 && <>
          <ResumeTable group="certificates" title="자격증 · 어학 · 교육" rows={form.resume.certificates} locked={locked} codes={codes} setRow={setRow} addRow={addRow} removeRow={removeRow} />
          <ResumeTable group="awards" title="수상" rows={form.resume.awards} locked={locked} codes={codes} setRow={setRow} addRow={addRow} removeRow={removeRow} />
          <ResumeTable group="careers" title="경력 · 아르바이트" rows={form.resume.careers} locked={locked} codes={codes} setRow={setRow} addRow={addRow} removeRow={removeRow} />
          <div className="ap-sec"><h3>계좌정보</h3><p className="fx-sub" style={{ margin: 0 }}>지금은 받지 않아요. 합격 뒤 협약 단계에서 받아요.</p></div>
        </>}

        {tab === 2 && <>
          <p className="fx-sub" style={{ margin: '0 0 18px' }}>1~3지망 공통 1부예요. 매칭된 기관이 읽으니 세 지망에 공통으로 맞게 써요. 문항마다 {ESSAY_MIN}자 이상.</p>
          {ESSAYS.map(([title, guide], i) => {
            const text = form.essays[i]
            const count = essayChars(text)
            const ok = count >= ESSAY_MIN
            const savedSame = text.trim() === String(app.essays?.[i] ?? '').trim()
            const hits = savedSame ? (app.essayWarnings ?? []).find((w) => w.index === i)?.institutions ?? [] : [...new Set(pickNames.filter((name) => text.includes(name)))]
            return <div key={title} className="ap-q">
              <header><b>{i + 1}. {title}</b><span className={`fx-count ${ok ? 'ok' : 'short'}`}>{ok ? `${count}자 · 충족` : `${count}자 · ${ESSAY_MIN - count}자 더`}</span></header>
              <p>{guide}</p>
              {locked ? <p className="ap-essay-read">{text || '—'}</p> : <textarea className="fx-textarea" aria-label={title} value={text} onChange={setEssay(i)} maxLength={3000} placeholder={`${ESSAY_MIN}자 이상 써 주세요`} />}
              {fieldErrors[`essays[${i}]`] && <small className="ap-err">{fieldErrors[`essays[${i}]`]}</small>}
              {!locked && hits.length > 0 && <p className="ap-warn">‘{hits.join('’, ‘')}’ 이름이 들어 있어요. 한 부가 세 기관에 같이 가요.</p>}
            </div>
          })}
        </>}

        {tab === 3 && <>
          <Consent title="개인정보 수집 · 이용" need rows={[['목적', '현장실습 참여자 선발 · 운영'], ['항목', '학과, 생년월일, 학년, 주소, 이메일, 계좌정보 등'], ['보유', '수행기간 동안 · 5년 보관']]} value={form.consents.collect} onPick={(v) => setConsent('collect', v)} locked={locked} />
          <Consent title="개인정보 제3자 제공" rows={[['받는 곳', '현장실습 기관 · 상해보험사'], ['항목', '성명, 생년월일, 학력정보, 주소, 연락처, 계좌정보'], ['보유', '수행기간 동안 · 5년 보관']]} value={form.consents.thirdParty} onPick={(v) => setConsent('thirdParty', v)} locked={locked} />
          <p className="fx-small" style={{ margin: '12px 0 0' }}>거부할 수 있지만, 거부하면 현장실습 신청 · 참여가 제한돼요. 수집 · 이용에 동의해야 지원서를 저장할 수 있어요.</p>
        </>}

        {tab === 4 && <>
          <div className="ap-sec"><h3>본인 서명</h3>
            {locked ? <p className="fx-sub" style={{ margin: 0 }}>{form.signature ? `‘${form.signature}’(으)로 서명했어요.` : '서명하지 않았어요.'}</p> : <>
              <p className="fx-sub" style={{ margin: '0 0 10px' }}>신청서의 성명(한글){clean(form.applicant.nameKo) ? ` ‘${clean(form.applicant.nameKo)}’` : ''}과 같게 쓰면 신청서 · 동의서의 전자서명이 돼요.</p>
              <input className="fx-input ap-sign" aria-label="서명할 이름" placeholder={clean(form.applicant.nameKo) ?? '이름'} maxLength={30} value={form.signature} onChange={(e) => setForm((f) => ({ ...f, signature: e.target.value }))} />
              {fieldErrors.signature ? <small className="ap-err">{fieldErrors.signature}</small>
                : !clean(form.applicant.nameKo) ? <small className="ap-err">신청서 탭에서 성명(한글)을 먼저 적어 주세요.</small>
                  : clean(form.signature) && !signed ? <small className="ap-err">신청서의 성명(한글)과 달라요. 같은 이름이어야 낼 수 있어요.</small> : null}
            </>}
          </div>
          <ApprovalBlock app={app} approval={approval} codes={codes} locked={locked} dirty={dirty} busy={busy} refreshing={refreshing} copied={copied} makeLink={makeLink} reload={reload} copyLink={copyLink} signed={signed} />
          {!locked && app.status === 'DRAFT' && <button type="button" className="fx-btn sm ghost ap-danger ap-delete-draft" disabled={Boolean(busy)} onClick={() => setConfirm('delete')}>{busy === 'delete' ? '지우는 중…' : '지원서 지우기'}</button>}
        </>}
        {(tab > 0 || tab < TABS.length - 1) && <div className="ap-next-actions">
          {tab > 0 && <button type="button" className="fx-btn" disabled={Boolean(busy)} onClick={() => { setTab(tab - 1); const tabs = document.querySelector('.ap-page .fx-tabs'); if (tabs) window.scrollTo({ top: Math.max(0, window.scrollY + tabs.getBoundingClientRect().top - 100), behavior: 'smooth' }) }}>← 이전</button>}
          {tab < TABS.length - 1 && <button type="button" className="fx-btn primary" disabled={Boolean(busy)} onClick={nextTab}>{busy === 'next' ? '저장 중…' : '다음 →'}</button>}
          {tab === TABS.length - 1 && !locked && <span className="ap-submit-wrap" tabIndex={submitBlockers.length ? 0 : undefined}>
            <button type="button" className="fx-btn primary" disabled={Boolean(busy) || submitBlockers.length > 0} onClick={() => setConfirm('submit')}>{busy === 'submit' ? '내는 중…' : fixing ? '고쳐서 다시 내기' : '지원서 내기'}</button>
            {submitBlockers.length > 0 && <span className="ap-submit-tooltip" role="tooltip"><b>아직 확인할 항목이 있어요</b>{submitBlockers.map((item) => <small key={item}>• {item}</small>)}</span>}
          </span>}
        </div>}
      </div></section>

      <aside className="fx-aside">
        <section className="fx-card tight">
          <div className="ap-aside-head"><h3 className="fx-h3">{locked ? '낸 지원서' : '내기 전 확인'}</h3><small>{doneCount} / {checklist.length}</small></div>
          <div className="ap-checks">
            {checklist.map((c) => <CheckRow key={c.item} check={c} app={app} codes={codes} missing={missing.includes(c.item)} go={() => { if (!(c.item in ITEM_TAB)) return; setTab(ITEM_TAB[c.item]); const tabs = document.querySelector('.ap-page .fx-tabs'); if (tabs) window.scrollTo({ top: Math.max(0, window.scrollY + tabs.getBoundingClientRect().top - 100), behavior: 'smooth' }) }} />)}
          </div>

          {locked
            ? <div className="ap-done" style={{ marginTop: 14 }}>
              <span>✓ {fmtDate(app.submittedAt)} 지원서를 냈어요{app.virtual ? ' (가상)' : ''}</span>
              <span style={{ fontWeight: 600 }}>{app.status === 'MATCHED' ? '센터가 매칭을 확정했어요. 면접 · 결과는 내 현장실습 타임라인에 보여요.' : '센터 접수함으로 갔어요. 상태가 바뀌면 내 현장실습 타임라인에 바로 보여요.'}</span>
              <div className="fx-row"><Link className="fx-btn sm" to="/internship">진행 상황 보기</Link></div>
            </div>
            : <div className="ap-actions">
              <button type="button" className="fx-btn primary block" disabled={Boolean(busy)} onClick={save}>{busy === 'save' ? '저장 중…' : dirty || app.status === 'NONE' ? '임시 저장' : '임시 저장됨'}</button>
            </div>}

          {notice && <div className={`ap-msg ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.text}
            {notice.list?.length > 0 && <ul>{notice.list.map((line) => <li key={line}>{line}</li>)}</ul>}
            {notice.link && <> <Link to={notice.link[0]}>{notice.link[1]}</Link></>}
          </div>}
        </section>

        <section className="fx-card tight">
          <div className="fx-row between"><b style={{ fontSize: 14 }}>진로취업상담</b><span className="badge blue" style={{ margin: 0 }}>매칭 가점</span></div>
          <p className="fx-small" style={{ margin: '6px 0 0' }}>이수하면 매칭 · 선발 때 가점이 있어요(재학 중 최대 5회). 지금 이수 {app.counselCount ?? 0}회.</p>
        </section>
      </aside>
    </div>

    {blocker.state === 'blocked' && <Modal close={() => { if (!busy) { setLeaveError(''); blocker.reset() } }}>{(dismiss) => <>
      <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>저장하지 않은 내용이 있어요</h2>
      <p>계속 작성하거나 임시 저장한 뒤 이동해 주세요.</p>
      {leaveError && <p className="ap-err" role="alert">{leaveError}</p>}
      <div className="button-row center"><button type="button" className="fx-btn" disabled={Boolean(busy)} onClick={dismiss}>계속 작성하기</button><button type="button" className="fx-btn dark" disabled={Boolean(busy)} onClick={saveAndLeave}>{busy === 'leave' ? '저장 중…' : '저장하고 나가기'}</button></div>
    </>}</Modal>}
    {confirm && <Modal close={() => setConfirm(null)}>{(dismiss) => confirm === 'delete'
      ? <>
        <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>지원서를 지울까요?</h2>
        <p>신청서 · 이력서 · 자기소개서 · 동의 · 서명과 승인 링크가 함께 지워져요. 담은 지망과 프로필은 그대로예요.</p>
        <div className="button-row center"><button type="button" className="fx-btn" onClick={dismiss}>그대로 두기</button><button type="button" className="fx-btn dark" onClick={() => { dismiss(); remove() }}>지우기</button></div>
      </>
      : <>
        <h2 style={{ margin: '0 0 6px', fontSize: 19 }}>{fixing ? '고친 지원서를 다시 낼까요?' : '지원서를 낼까요?'}</h2>
        <p>{dirty ? (approval.status === 'APPROVED' || approval.status === 'REQUESTED' ? '바꾼 내용을 먼저 저장해요. 승인 뒤 내용이 바뀌면 학과(부)장 승인을 다시 받아야 낼 수 있어요. ' : '바꾼 내용을 먼저 저장한 뒤 내요. ') : ''}낸 뒤에는 센터가 보완을 요청할 때만 고칠 수 있어요. 한 부가 1~3지망 기관에 같이 가요.</p>
        <div className="button-row center"><button type="button" className="fx-btn" onClick={dismiss}>더 고치기</button><button type="button" className="fx-btn primary" onClick={() => { dismiss(); submit() }}>{fixing ? '다시 내기' : '내기'}</button></div>
      </>}</Modal>}
  </div></main>
}

const fieldLabel = (field) => {
  const key = String(field ?? '').replace(/^applicant\./, '')
  if (FIELD_LABEL[key]) return FIELD_LABEL[key]
  const essay = /^essays\[(\d)\]/.exec(key)
  if (essay) return `자기소개서 ${Number(essay[1]) + 1}번`
  const row = /^resume\.(\w+)\[(\d+)\]/.exec(key)
  if (row) return `${{ certificates: '자격증 · 교육', awards: '수상', careers: '경력' }[row[1]] ?? '이력서'} ${Number(row[2]) + 1}번째 줄`
  return key
}

function HeroSide({ app, locked, fixing }) {
  const status = studentAppStatus(app.status)
  if (locked || fixing) {
    return <div className="fx-hero-side ap-hero-side">
      <span className="fx-small" style={{ fontWeight: 800 }}>접수번호</span>
      <span className="fx-big">{app.receiptNo ?? '—'}</span>
      <span className={`fx-dday ${STATUS_TONE[app.status] ?? ''}`}>{status}</span>
      <span className="fx-small">{fmtDateTime(app.submittedAt)} 냄{app.receivedAt ? ` · ${fmtDate(app.receivedAt)} 접수` : ''}</span>
    </div>
  }
  const ends = app.period?.endsOn
  const left = ends && app.asOf ? daysBetween(app.asOf, ends) : null
  const day = ends ? fmtDate(ends, true) : ''
  const [date, weekday] = day.split('(')
  return <div className="fx-hero-side ap-hero-side">
    <span className="fx-small" style={{ fontWeight: 800 }}>제출 마감</span>
    <span className="fx-big">{date}{weekday && <small>({weekday}</small>}</span>
    {app.period?.open ? <span className="fx-dday">{left === 0 ? 'D-DAY' : `D-${left}`}</span> : <span className="fx-dday gray">신청 기간 아님</span>}
    <span className="fx-small">{app.updatedAt ? `${fmtDateTime(app.updatedAt)} 임시 저장됨` : '아직 저장하지 않았어요'}</span>
  </div>
}

function FieldRow({ label: text, value, onChange, readOnly, error, display, ...rest }) {
  return <div><dt>{text}</dt><dd>
    {readOnly ? (display || value || '—') : <input className="fx-input" aria-label={text} value={value} onChange={onChange} aria-invalid={Boolean(error)} {...rest} />}
    {error && <small className="ap-err">{error}</small>}
  </dd><span /></div>
}

function ResumeTable({ group, title, rows, locked, codes, setRow, addRow, removeRow }) {
  const spec = RESUME[group]
  const kinds = codes?.resumeKind ?? { CERTIFICATE: '자격증', LANGUAGE: '어학', EDUCATION: '교육' }
  const isCert = group === 'certificates'
  const cols = isCert ? ['kind', ...spec.keys] : spec.keys
  const head = spec.head
  if (locked) {
    return <div className="ap-sec"><h3>{title}</h3>
      {rows.length === 0 ? <p className="ap-none">없어요.</p> : <>
        <div className="ap-table head">{head.map((h) => <span key={h}>{h}</span>)}</div>
        {rows.map((row, i) => <div key={i} className="ap-table">{cols.map((k) => <span key={k}>{k === 'kind' ? label(codes, 'resumeKind', row.kind) : row[k] || '-'}</span>)}</div>)}
      </>}
    </div>
  }
  return <div className="ap-sec"><h3>{title}</h3>
    {rows.length > 0 && <>
      <div className="ap-table edit head">{head.map((h) => <span key={h}>{h}</span>)}<span /></div>
      {rows.map((row, i) => <div key={i} className="ap-table edit">
        {isCert && <select className="fx-input" aria-label={`${title} ${i + 1} 구분`} value={row.kind} onChange={(e) => setRow(group, i, 'kind', e.target.value)}>{Object.entries(kinds).map(([code, text]) => <option key={code} value={code}>{text}</option>)}</select>}
        {spec.keys.map((k, j) => <input key={k} className="fx-input" aria-label={`${title} ${i + 1} ${head[isCert ? j + 1 : j]}`} placeholder={spec.holder[j]} value={row[k]} maxLength={k === 'detail' || k === 'note' ? 100 : 60} onChange={(e) => setRow(group, i, k, e.target.value)} />)}
        <button type="button" className="ap-del" aria-label={`${title} ${i + 1}번째 줄 지우기`} onClick={() => removeRow(group, i)}>×</button>
      </div>)}
    </>}
    {rows.length < RESUME_MAX && <button type="button" className="ap-add" aria-label={`${title} 입력 줄 추가`} onClick={() => addRow(group)}>＋</button>}
  </div>
}

function Consent({ title, rows, value, onPick, locked, need = false }) {
  return <div className="ap-consent">
    <b>{title}</b>{need && <span className="ap-need">저장에 필요</span>}
    <dl>{rows.map(([dt, dd]) => <div key={dt} className="ap-consent-item"><dt>{dt}</dt><dd>{dd}</dd></div>)}</dl>
    {locked ? <span className={`badge ${value ? 'green' : ''}`}>{value ? '동의함' : '동의 안 함'}</span>
      : <div className="fx-seg ap-seg" role="radiogroup" aria-label={`${title} 동의`} style={{ width: 220 }}>
        {[['예', true], ['아니요', false]].map(([text, v]) => <button key={text} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onPick(v)}>{text}</button>)}
      </div>}
  </div>
}

function CheckRow({ check, app, codes, missing, go }) {
  const approval = app.approval?.status ?? 'NONE'
  const [text, tone] = check.done ? ['완료', 'green'] : check.item === 'APPROVAL' && approval === 'REQUESTED' ? ['승인 대기', 'blue'] : check.item === 'APPROVAL' && approval === 'STALE' ? ['다시 요청', 'orange'] : ['남음', 'orange']
  const inner = <><span>{label(codes, 'applicationItem', check.item)}</span><span className={`badge ${tone}`}>{text}</span></>
  return <button type="button" className={`ap-check${missing ? ' is-missing' : ''}`} onClick={go}>{inner}</button>
}

function ApprovalBlock({ app, approval, codes, locked, dirty, busy, refreshing, copied, makeLink, reload, copyLink, signed }) {
  const status = approval.status ?? 'NONE'
  const url = approval.token && status !== 'STALE' ? approvalUrl(approval.token) : null
  const dept = app.academic?.department?.name ?? '학과(부)'
  const [badgeText, tone] = { APPROVED: ['승인됨', 'green'], REQUESTED: ['승인 대기', 'blue'], STALE: ['다시 요청', 'orange'], NONE: ['요청 전', ''] }[status] ?? [label(codes, 'approvalStatus', status), '']
  const sub = status === 'APPROVED' ? `${fmtDateTime(approval.approvedAt)} 승인` : status === 'REQUESTED' ? `${fmtDateTime(approval.requestedAt)} 링크 만듦 · 학과 사무실` : status === 'STALE' ? '승인 뒤 지원서 · 지망 · 프로필이 바뀌었어요' : '링크를 만들어 학과 사무실에 전해요'
  return <div className="ap-sec"><h3>학과(부)장 승인</h3>
    <div className="ap-check"><span>{dept}<small>{sub}</small></span><span className={`badge ${tone}`}>{badgeText}</span></div>
    {status === 'STALE' && !locked && <div className="fx-callout warn"><span className="fx-callout-icon">!</span><span><b>내용이 바뀌어 다시 요청해야 해요.</b> 전 링크는 승인할 수 없어요. 새 링크를 만들어 학과 사무실에 다시 전해 주세요.</span></div>}
    {url && !locked && <div className="ap-link">
      <input className="fx-input" readOnly aria-label="학과(부)장 승인 링크" value={url} onFocus={(e) => e.target.select()} />
      <button type="button" className="fx-btn sm" onClick={() => copyLink(url)}>{copied ? '복사했어요 ✓' : '링크 복사'}</button>
      <a className="fx-btn sm" href={url} target="_blank" rel="noreferrer">새 탭에서 열기 ↗</a>
    </div>}
    {!locked && <div className="fx-row wrap ap-appr-actions">
      {status !== 'APPROVED' && <button type="button" className="fx-btn sm primary" disabled={Boolean(busy) || !signed} title={signed ? undefined : '본인 서명을 신청서 성명과 같게 적은 뒤 만들어요'} onClick={makeLink}>{busy === 'link' ? '만드는 중…' : status === 'NONE' ? '학과(부)장 승인 링크 만들기' : '새 링크 만들기'}</button>}
      {approval.token && <button type="button" className="fx-btn sm ghost" disabled={refreshing} onClick={reload}>{refreshing ? '확인 중…' : '승인 상태 새로 고침'}</button>}
    </div>}
    {!locked && !signed && status !== 'APPROVED' && <p className="fx-small fx-orange" style={{ margin: '8px 0 0', fontWeight: 700 }}>본인 서명을 신청서의 성명(한글)과 같게 적은 뒤 링크를 만들어요. 승인은 지금 내용으로 받아서, 승인 뒤 서명을 고치면 다시 받아야 해요.</p>}
    {!locked && dirty && status !== 'NONE' && <p className="fx-small fx-orange" style={{ margin: '8px 0 0', fontWeight: 700 }}>바꾼 내용을 저장하면 이 승인은 '다시 요청'이 돼요.</p>}
    {!locked && <p className="fx-small" style={{ margin: '10px 0 0' }}>{status === 'NONE' ? '링크를 만들면 지금 저장한 내용으로 승인을 받아요(바뀐 내용이 있으면 먼저 저장해요). ' : ''}학과(부)장은 로그인 없이 링크로 열어 승인해요. 시연에서는 [새 탭에서 열기]로 직접 승인을 눌러 볼 수 있어요.</p>}
    <p className="fx-small" style={{ margin: '6px 0 0' }}>학과(부)장 승인을 받은 뒤 신청 기간 안에 내요. 복수전공 학점을 인정받으려면 두 학과(부)장 모두 승인해야 해요.</p>
  </div>
}
