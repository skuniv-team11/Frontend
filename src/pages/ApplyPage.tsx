import { Link } from 'react-router-dom'
import { ActionCard, PageTitle } from '../components/PageParts'
import { Badge, Shell } from '../components/Shell'

export function ApplyPage(){return <Shell><main className="content two-column"><section><Link className="back" to="/plan">← 내 지망으로</Link><PageTitle eyebrow="지원 전 마지막 확인" title="기간과 제출물을 확인해 주세요"/><div className="card deadline"><div><small>지원 마감</small><strong>7월 26일(금) 17:00</strong></div><Badge tone="orange">D-8</Badge></div><div className="card checklist"><h2>나의 준비 목록</h2>{['이력서 최신 내용 확인','학교 현장실습 신청서','개인정보 수집·이용 동의서','담당 교수 확인'].map((item,index)=><label key={item}><input type="checkbox" defaultChecked={index===0}/><span><b>{item}</b><small>{index===0?'확인했어요':'학교 포털에서 준비해 주세요'}</small></span></label>)}</div></section><ActionCard action={<Link className="button full" to="/plan">내 지망으로 돌아가기</Link>}><h3>제출하는 곳</h3><p>학교 현장실습 포털에서 직접 제출해 주세요.</p><p className="notice">현장뛰자는 신청서를 대신 작성하거나 제출하지 않아요.</p></ActionCard></main></Shell>}
