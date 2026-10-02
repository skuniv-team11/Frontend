export type Job = {
  id: string
  company: string
  title: string
  location: string
  verdict: '지원 가능' | '확인 필요'
  fit: '높음' | '보통'
  seats: number
}

export const jobs: Job[] = [
  { id: 'beauty-marketing', company: '라온뷰티', title: '뷰티 브랜드 마케팅', location: '서울 성동구', verdict: '지원 가능', fit: '높음', seats: 3 },
  { id: 'package-design', company: '누아코스메틱', title: '화장품 패키지 디자인', location: '서울 마포구', verdict: '지원 가능', fit: '높음', seats: 2 },
  { id: 'product-assistant', company: '모먼트랩', title: '상품 기획 보조', location: '경기 성남시', verdict: '확인 필요', fit: '보통', seats: 4 },
  { id: 'customer-experience', company: '뷰티온', title: '고객 경험 운영', location: '서울 강남구', verdict: '지원 가능', fit: '보통', seats: 2 },
  { id: 'visual-content', company: '아뜰리에온', title: '비주얼 콘텐츠 제작', location: '서울 용산구', verdict: '확인 필요', fit: '높음', seats: 1 },
]
