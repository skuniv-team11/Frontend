// 체험 학생 시점(#5 stage). 제목의 날짜는 codes.guestStage('지원 중(7/23)')를 쓰고, codes가 없을 때만 아래 제목을 쓴다.
export const STAGES = [
  ['APPLYING', '지원 중', '지망 정하고 지원서 쓰기, 직무 탐색'],
  ['PRACTICING', '실습 중', '1지망 합격 뒤 실습 중 · 중간점검'],
  ['DONE', '실습 마친 뒤', '마무리 서류 · 커리어 리포트'],
]
export const stageTitle = (codes, stage, fallback) => codes?.guestStage?.[stage] ?? fallback
