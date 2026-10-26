import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadCreditsCsv, getCenterClose, remindClose, saveBlob, setCloseDocuments } from '../../api/center'
import { getCurrentRound, label } from '../../api/reference'
import { Empty, ErrorBox, Loading, VirtualTag } from '../../components/v2'
import { useRequest } from '../../hooks/useRequest'
import { useCodes } from '../../hooks/useSession'
import { fmtDateTime } from '../../lib/format'
import { CenterDemoBanner, ErrorLine, md, stageOf, studentLine, useDemoReload } from './centerKit'
import './CenterPage.css'
import './CenterV2.css'

const STUDENT_DOCS = [['REPORT', 'report'], ['CREDIT', 'credit'], ['SURVEY', 'survey']]
const STUDENT_ITEMS = STUDENT_DOCS.map(([code]) => code)

function DocMark({ at }) {
  return at ? <><span className="cl-ok" aria-label="냄">✓</span><small className="cl-date">{md(at)}</small></> : <span className="cl-no" aria-label="안 냄">–</span>
}

function ApprovalCell({ approval, codes }) {
  const status = approval?.status ?? 'NONE'
  const link = approval?.token ? <a className="cl-link" href={`/approvals/${approval.token}`} target="_blank" rel="noreferrer">링크 열기</a> : null
  if (status === 'APPROVED') return <><span className="cl-ok" title={label(codes, 'approvalStatus', status)}>✓</span>{link ?? <small className="cl-date">{md(approval.approvedAt)}</small>}</>
  if (status === 'NONE') return <span className="cl-no" title="기관 서류를 둘 다 받으면 승인 링크가 생겨요">–</span>
  return <><small className="cl-date">{label(codes, 'approvalStatus', status)}</small>{link}</>
}

export function CenterClosePage() {
  const codes = useCodes()
  const close = useRequest(getCenterClose)
  const round = useRequest(getCurrentRound)
  useDemoReload(close.reload)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState('')
  const data = close.data
  const r = round.data
  const practice = stageOf(r, 'PRACTICE')
  const debrief = stageOf(r, 'DEBRIEF')
  const kicker = r ? [r.termCode, practice?.endsOn && `실습 종료 ${md(practice.endsOn)}`, debrief?.startsOn && `후기 간담회 ${md(debrief.startsOn)}`].filter(Boolean).join(' · ') : '마무리'

  const run = async (key, call, message) => {
    setBusy(key); setError(null); setDone('')
    try { const result = await call(); if (message) setDone(message(result)); return result } catch (caught) { setError(caught); return null } finally { setBusy(null) }
  }
  // 기관 서류 받음 표시(#55) — 두 칸을 함께 보낸다
  const toggle = (row, field) => run(`${row.applicationId}-${field}`, async () => {
    const body = { evaluation: Boolean(row.documents.evaluation), attendance: Boolean(row.documents.attendance), [field]: !row.documents[field] }
    const next = await setCloseDocuments(row.applicationId, body)
    close.mutate(next)
    return next
  })
  const remind = () => run('remind', async () => { const result = await remindClose(); close.reload(); return result }, (result) => `학생 서류를 안 낸 ${result.reminded}명에게 알렸어요. 학생 내 현장실습에 보여요.`)
  const download = () => run('csv', async () => { const file = await downloadCreditsCsv(); saveBlob(file); return file }, (file) => `${file.filename} 파일을 내려받았어요.`)

  const head = <>
    <CenterDemoBanner note="평가표 · 출근부는 기관이 메일로 보낸 걸 센터가 받음 표시해요" />
    <div className="center-head">
      <header className="page-title"><span>{kicker}</span><h1>마무리 서류를 모아 학점 인정 명단을 만들어요</h1></header>
      <span className="fx-small" style={{ fontWeight: 800 }}>학생 서류는 내 현장실습에서 낸 그대로 들어와요</span>
    </div>
  </>
  if (!data) {
    return <main className="center-page cv2 cv2-flow">{head}
      {close.error ? <ErrorBox error={close.error} fallback="마무리 서류를 불러오지 못했어요." retry={close.reload} /> : <Loading text="마무리 서류를 불러오는 중…" note="서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요." />}
    </main>
  }

  const { counts, rows } = data
  const missingStudents = rows.map((row) => ({ row, items: row.missing.filter((code) => STUDENT_ITEMS.includes(code)) })).filter((item) => item.items.length > 0)
  const otherMissing = rows.map((row) => ({ row, items: row.missing.filter((code) => !STUDENT_ITEMS.includes(code)) })).filter((item) => item.items.length > 0)

  return <main className="center-page cv2 cv2-flow">{head}
    {close.error && <ErrorBox error={close.error} fallback="다시 불러오지 못했어요." retry={close.reload} />}
    <section className="metrics c4">{[['참여 학생', `${counts.students}명`], ['학생 서류 다 냄', `${counts.studentDocsDone}명`], ['기관 서류 받은 곳', `${counts.institutionsDone} / ${counts.institutions}곳`], ['학점 인정 명단', `${counts.ready}명`]].map(([name, value]) => <div key={name}><small>{name}</small><b>{value}</b></div>)}</section>
    <div className="dashboard">
      <div className="fx-stack">
        {rows.length === 0 ? <Empty title="합격을 알린 학생이 아직 없어요" action={<Link className="fx-btn" to="/center/match">매칭 · 선발로</Link>}>매칭 · 선발에서 결과를 알리면 합격한 학생의 마무리 서류를 여기서 모아요.</Empty>
          : <section className="fx-table">
            <div className="fx-thead cl-cols cl-th"><span>학생 · 기관 · 직무</span><span>결과보고서<i className="cl-who">학생</i></span><span>학점인정 신청서<i className="cl-who">학생</i></span><span>설문<i className="cl-who">학생</i></span><span>평가표<i className="cl-who">기관 → 센터</i></span><span>출근부<i className="cl-who">기관 → 센터</i></span><span>학과장 승인<i className="cl-who">링크</i></span><span>상태</span></div>
            {rows.map((row) => <div key={row.applicationId} className="fx-tr cl-cols cl-row">
              <span><b>{row.student?.nameKo}</b><VirtualTag show={row.virtual} /><small>{studentLine(row.student)}</small><small>{row.job?.institution?.name} · {row.job?.title}</small></span>
              {STUDENT_DOCS.map(([code, key]) => <span key={code}><DocMark at={row.documents[key]} /></span>)}
              {[['evaluation', '평가표'], ['attendance', '출근부']].map(([field, name]) => {
                const on = Boolean(row.documents[field])
                return <span key={field}><button type="button" className={`cl-toggle ${on ? 'on' : ''}`} aria-pressed={on} aria-label={`${row.student?.nameKo} ${name} ${on ? '받음 — 누르면 취소' : '받음 표시'}`} title={on ? `${md(row.documents[field])} 받음 · 누르면 취소` : '누르면 받음 표시'} disabled={Boolean(busy)} onClick={() => toggle(row, field)}>{busy === `${row.applicationId}-${field}` ? '…' : on ? '✓' : '–'}</button></span>
              })}
              <span><ApprovalCell approval={row.approval} codes={codes} /></span>
              <span><span className={`badge ${row.ready ? 'green' : 'orange'}`} title={row.missing.map((code) => label(codes, 'closeItem', code)).join(' · ')}>{row.ready ? '인정 가능' : `${row.missing.length}개 남음`}</span></span>
            </div>)}
          </section>}
        <ErrorLine error={error} />
        {done && <p className="cv2-ok" role="status">{done}</p>}
      </div>
      <aside className="fx-stack">
        <section className="fx-card tight"><h3 className="fx-h3">기관 서류 받기</h3>
          <p className="fx-small">기관 계정이 없어서 평가표 · 출근부는 기관이 메일로 보낸 걸 센터가 받음 표시해요. 표의 칸을 눌러 바꿔요. 둘 다 받으면 학과(부)장 학점 인정 승인 링크가 생겨요.</p>
          {otherMissing.length > 0 && otherMissing.map(({ row, items }) => <div key={row.applicationId} className="c-line"><span>{row.student?.nameKo}<small>{items.map((code) => label(codes, 'closeItem', code)).join(' · ')}</small></span><span className="badge gray">{items.length}개</span></div>)}
        </section>
        <section className="fx-card tight"><h3 className="fx-h3">안 낸 학생 서류</h3>
          {missingStudents.length === 0 ? <p className="fx-small">{rows.length ? '학생 서류를 모두 냈어요.' : '참여 학생이 아직 없어요.'}</p>
            : missingStudents.map(({ row, items }) => <div key={row.applicationId} className="c-line"><span>{row.student?.nameKo}<VirtualTag show={row.virtual} /><small>{items.map((code) => label(codes, 'closeItem', code)).join(' · ')}</small></span><span className="badge orange">{items.length}개</span></div>)}
          <button type="button" className="fx-btn sm" style={{ marginTop: 10 }} disabled={missingStudents.length === 0 || Boolean(busy)} onClick={remind}>{busy === 'remind' ? '알리는 중…' : '안 낸 학생에게 알림'}</button>
          {data.remindedAt && <p className="cv2-hint">마지막 알림 {fmtDateTime(data.remindedAt)}</p>}
        </section>
        <section className="fx-card tight"><h3 className="fx-h3">학점 인정 · 장학금 명단</h3>
          <p className="fx-small">서류가 다 모이고 학과(부)장이 승인한 학생만 들어가요. 표준 현장실습 D 12학점 · 대학 지원금 월 20만 원 × 최대 3개월(학생 모집안내).</p>
          <button type="button" className="fx-btn sm primary" style={{ marginTop: 10 }} disabled={counts.ready === 0 || Boolean(busy)} onClick={download}>{busy === 'csv' ? '만드는 중…' : `명단 내려받기 · CSV ${counts.ready}명`}</button>
          {counts.ready === 0 && rows.length > 0 && <p className="cv2-hint">아직 서류가 다 모인 학생이 없어요.</p>}
        </section>
      </aside>
    </div>
  </main>
}
