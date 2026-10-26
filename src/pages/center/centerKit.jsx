import { useEffect } from 'react'
import { errorMessage } from '../../api/client'
import { label } from '../../api/reference'
import { DEMO_EVENT } from '../../layout/Header'

// 센터 화면 공통 조각(현황판 · 접수함 · 매칭·선발 · 마무리)

// 시연 배너 — 가상 데이터 표시는 빼지 않는다(AGENTS.md). 오른쪽 b는 화면별 덧붙임
export function CenterDemoBanner({ note }) {
  return <div className="demo-banner cv2-demo"><span>DEMO</span>체험 센터 · 가상 지원자 6명과 같은 브라우저의 체험 학생만 보여요{note && <b>{note}</b>}</div>
}

// 상단 '시연' 버튼 뒤 다시 불러오기. reload는 useRequest의 reload처럼 고정된 함수
export function useDemoReload(reload) {
  useEffect(() => {
    window.addEventListener(DEMO_EVENT, reload)
    return () => window.removeEventListener(DEMO_EVENT, reload)
  }, [reload])
}

// 오류 문장 + 입력 검증 이유(fields)
export const errText = (error) => {
  if (!error) return ''
  const reasons = (error.fields ?? []).map((field) => field.reason).filter(Boolean)
  const base = errorMessage(error)
  return reasons.length ? `${base} — ${reasons.join(' · ')}` : base
}

export function ErrorLine({ error }) {
  if (!error) return null
  return <p className="cv2-error" role="alert">{errText(error)}</p>
}

// 지원서 상태 꼬리표(codes.applicationStatus)
const STATUS_TONE = { SUBMITTED: 'blue', RECEIVED: 'green', FIX_REQUESTED: 'orange', MATCHED: 'gray' }
export function StatusBadge({ codes, status }) {
  return <span className={`badge ${STATUS_TONE[status] ?? 'gray'}`}>{label(codes, 'applicationStatus', status)}</span>
}

// 학생 한 줄: 광고홍보콘텐츠학과 4학년 · 졸업예정
export const studentLine = (student) => {
  if (!student) return ''
  const parts = [student.department?.name, student.grade ? `${student.grade}학년` : null].filter(Boolean).join(' ')
  return student.graduationExpected ? `${parts} · 졸업예정` : parts
}

// 2026-07-16T10:00:00+09:00 → 7/16 (서버가 한국 시간 오프셋으로 준다)
export const md = (iso) => {
  if (!iso) return ''
  const [, m, d] = String(iso).slice(0, 10).split('-')
  return `${Number(m)}/${Number(d)}`
}

// closesOn은 '이 날부터 지원 불가' — 화면에는 하루 전을 마감일로 보여 준다
export const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

// 회차 일정(#13 stages)에서 한 단계의 기간 → '7/27~7/28'
export const stageRange = (round, code) => {
  const stage = round?.stages?.find((item) => item.code === code)
  if (!stage?.startsOn) return ''
  if (!stage.endsOn || stage.endsOn === stage.startsOn) return md(stage.startsOn)
  return `${md(stage.startsOn)}~${md(stage.endsOn)}`
}
export const stageOf = (round, code) => round?.stages?.find((item) => item.code === code) ?? null

// 원문 인용 한 칸(문서명 · 쪽). 원문 PDF는 띄우지 않는다
export function QuoteBox({ tag, title, page, quote }) {
  if (!quote) return null
  return <div className="fx-quote cv2-quote"><blockquote>“{quote}”</blockquote><p>{tag && <b>{tag}</b>}{title}{page ? ` · ${page}쪽` : ''}</p></div>
}

// 검토 알림 한 건(codes.alertKind · 문서명 · 쪽 · 인용 A/B · 설명)
export function AlertItem({ alert, codes, jobTitle }) {
  return <div className="cv2-alert">
    <div className="fx-row wrap"><span className="badge orange">{label(codes, 'alertKind', alert.kind)}</span><b>{alert.institution?.name}</b><small>{alert.jobId ? (jobTitle ?? '직무 하나') : '기관 전체'}</small></div>
    <p>{alert.description}</p>
    <QuoteBox tag={alert.quoteB ? 'A' : null} title={alert.documentTitle} page={alert.pageA} quote={alert.quoteA} />
    <QuoteBox tag="B" title={alert.documentTitle} page={alert.pageB} quote={alert.quoteB} />
  </div>
}
