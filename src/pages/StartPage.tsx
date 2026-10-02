import { Link } from 'react-router-dom'
import { Badge, Shell } from '../components/Shell'

export function StartPage() {
  return <Shell><main className="landing">
    <section className="hero"><span className="eyebrow">학교 밖에서, 내 일을 먼저 만나보세요</span><h1>지원할 수 있는 현장실습,<br />이유까지 보면 <em>보여요.</em></h1><p>내 전공과 학년을 바탕으로 지원 조건을 먼저 확인하고,<br />공고 원문 근거와 함께 나에게 맞는 직무를 찾아보세요.</p><div className="button-row"><Link className="button primary" to="/profile">예시 프로필로 시작</Link><Link className="button" to="/login">로그인·가입으로 시작</Link></div><Link className="minor-link" to="/center">센터 담당자로 보기 →</Link></section>
    <aside className="preview-card"><div className="space-between"><b>나에게 맞는 직무</b><Badge tone="green">지원 가능</Badge></div><small>라온뷰티</small><h2>뷰티 브랜드 마케팅</h2><p>서울 성동구 · 3명 모집</p><blockquote>“콘텐츠 기획과 SNS 채널 운영을 함께 경험할 수 있어요.”</blockquote><span className="source">공고 원문 3쪽에서 확인</span></aside>
    <section className="steps">{[['01','프로필 입력','전공·학년·이수 학기만 간단히'],['02','지원 가능 확인','학교 규정과 공고 조건을 함께'],['03','1~3지망 정리','모집 신호와 빈 자리까지 한눈에']].map(([n,t,d])=><div key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</section>
  </main></Shell>
}
