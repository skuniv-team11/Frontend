import { Link } from 'react-router-dom'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { Badge } from '../../components/Shell'
import { jobs } from '../../mock/jobs'

export function CounselPage(){return <main className="content two-column"><section><Link className="back" to="/plan">← 내 지망으로</Link><PageTitle eyebrow="진로취업상담에 가져가세요" title="선택한 지망을 이유와 함께 모았어요"/>{jobs.slice(0,3).map((job,index)=><article className="card counsel" key={job.id}><b className="rank">{index+1}지망</b><div><small>{job.company}</small><h3>{job.title}</h3><p>전공에서 배운 콘텐츠 기획 경험을 실무에서 이어갈 수 있어서 선택했어요.</p><Badge tone="green">{job.verdict}</Badge></div></article>)}<div className="card questions"><h2>상담할 때 물어볼 것</h2><label><input type="checkbox"/> 이 직무가 희망 진로와 어떻게 이어지나요?</label><label><input type="checkbox"/> 지원 전에 더 준비할 경험이 있나요?</label></div></section><ActionCard action={<button className="button primary full" onClick={()=>window.print()}>인쇄하기</button>}><h3>상담 요약</h3><p>1지망은 콘텐츠 기획, 2지망은 디자인 경험에 초점을 두고 있어요.</p></ActionCard></main>}
