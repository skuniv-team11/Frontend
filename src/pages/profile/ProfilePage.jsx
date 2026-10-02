import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { SidePanel } from '../../components/Shell'

export function ProfilePage() {
  const [rules,setRules]=useState(false); const navigate=useNavigate()
  return <main className="content two-column"><section><PageTitle eyebrow="나를 알려주세요" title="내 프로필" description="지원할 수 있는 직무를 정확히 찾는 데만 사용해요."/><div className="card form-card"><div className="form-grid"><label>학교<input value="서경대학교" readOnly/></label><label>학년<div className="segments"><button>1학년</button><button>2학년</button><button className="selected">3학년</button><button>4학년</button></div></label><label>학과<input value="메이크업디자인학과" readOnly/></label><label>이수 학기<div className="counter"><button>−</button><b>5</b><button>＋</button></div></label><label>사는 곳<input value="서울특별시 성북구" readOnly/></label><label>평점<input value="3.8 / 4.5" readOnly/></label></div><label className="check"><input type="checkbox"/> 이 프로필을 다음 방문에도 사용할 수 있도록 저장합니다.</label><p className="notice">저장에 동의하지 않으면 이번 추천에만 사용하고 남기지 않아요.</p></div><button className="link-button" onClick={()=>setRules(true)}>학교 현장실습 규정 4가지 확인하기 →</button></section><ActionCard action={<button className="button primary full" onClick={()=>navigate('/jobs')}>이 프로필로 직무 찾기</button>}><h3>이 프로필로 확인할 내용</h3><ul><li>학년과 이수 학기</li><li>학과·전공 조건</li><li>기관별 별도 지원 조건</li></ul></ActionCard>{rules&&<SidePanel title="학교 규정 4가지" close={()=>setRules(false)}><ol className="rules"><li>현장실습 참여 학기 기준</li><li>최소 이수 학기 기준</li><li>학점 및 학적 상태 확인</li><li>학과별 승인 절차</li></ol><p className="notice">최종 지원 전 학교 담당자의 확인이 필요할 수 있어요.</p></SidePanel>}</main>
}
