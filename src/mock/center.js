export const centerPreviewRound = {
  termCode: '2026-2',
  programName: '학기제 현장실습',
  roundNo: 1,
  recruitStart: '2026-09-01',
  recruitEnd: '2026-10-31',
  replay: { minDate: '2026-09-01', maxDate: '2026-10-31', defaultAsOf: '2026-10-06' },
}

const previewRows = [
  { jobId: 'preview-1', title: '디지털 브랜드 콘텐츠 기획', institution: { name: '미디어코퍼스' }, headcount: 4, eligiblePool: 28, alertCount: 1, signal: { status: 'OPEN', intent: 3, interest: 9, closesOn: '2026-10-19', closeReason: 'DEADLINE', closesOnIsVirtual: true, expectedFullOn: '2026-10-14' }, risks: [{ code: 'DOCUMENT_MISMATCH', label: '문서 확인 필요', detail: '근무 기간 표기' }] },
  { jobId: 'preview-2', title: '공공데이터 분석 지원', institution: { name: '서울디지털재단' }, headcount: 3, eligiblePool: 21, alertCount: 0, signal: { status: 'OPEN', intent: 2, interest: 7, closesOn: '2026-10-24', closeReason: 'DEADLINE', closesOnIsVirtual: true }, risks: [] },
  { jobId: 'preview-3', title: '브랜드 마케팅 운영', institution: { name: '로우세븐' }, headcount: 5, eligiblePool: 34, alertCount: 0, signal: { status: 'OPEN', intent: 4, interest: 11, closesOn: '2026-10-28', closeReason: 'DEADLINE', closesOnIsVirtual: true }, risks: [] },
  { jobId: 'preview-4', title: '지역문화 프로젝트 매니저', institution: { name: '성북문화재단' }, headcount: 2, eligiblePool: 16, alertCount: 1, signal: { status: 'OPEN', intent: 0, interest: 4, closesOn: '2026-10-16', closeReason: 'DEADLINE', closesOnIsVirtual: true }, risks: [{ code: 'LOW_INTENT', label: '지원 의사 없음', detail: '관심 학생 4명' }] },
  { jobId: 'preview-5', title: '서비스 UX 리서치 보조', institution: { name: '리서치랩' }, headcount: 3, eligiblePool: 19, alertCount: 0, signal: { status: 'CLOSED', intent: 3, interest: 8, closesOn: '2026-10-05', closeReason: 'DEADLINE', closesOnIsVirtual: true }, risks: [] },
]

export const createCenterPreviewBoard = (asOf = centerPreviewRound.replay.defaultAsOf) => ({
  asOf,
  isVirtual: true,
  signalSource: 'SIMULATION',
  summary: { jobs: 5, seats: 17, interestTotal: 12, zeroSignalJobs: 1, closedJobs: 1 },
  rows: previewRows,
  alerts: [{ id: 'preview-alert-1', kind: 'DOCUMENT_MISMATCH', institution: { name: '미디어코퍼스' }, description: '운영계획서와 모집 안내의 근무 기간 표기가 달라 확인이 필요합니다.', quoteA: '실습 기간은 16주로 운영합니다.', quoteB: '실습 기간: 15주', pageA: 3, pageB: 1 }],
})
