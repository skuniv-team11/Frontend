// 표기 도우미(화면 공통)
export const VERDICT_LABEL = { ELIGIBLE: '지원 가능', NEEDS_CHECK: '확인 필요', INELIGIBLE: '지원 불가' }

// 날짜 표기 2026-07-23 → 7월 23일(목)
const DAYS = ['일', '월', '화', '수', '목', '금', '토']
export const fmtDate = (iso, withDay = false) => {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00+09:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getMonth() + 1}월 ${d.getDate()}일${withDay ? `(${DAYS[d.getDay()]})` : ''}`
}
export const fmtDateTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
}
export const won = (n) => (n == null ? '' : `${Number(n).toLocaleString('ko-KR')}원`)

// 선호 전공(판정에 넣지 않는 참고) — 목록·상세가 같은 말을 쓴다
export const MAJOR_LABEL = { MATCH: '선호 전공 안', NEAR: '가까운 전공', OPEN: '전공 무관', NOT_LISTED: '선호 전공 밖' }
export const MAJOR_NOTE = '지원 판정에는 넣지 않아요. 지난 매칭 73명 중 18명은 선호 전공 밖이어도 매칭됐어요. 직무 탐색 추천에서는 같은 근거 단계 안에서 선호 전공 자리를 앞에 둬요.'
