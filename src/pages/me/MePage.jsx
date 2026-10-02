import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionCard, PageTitle } from '../../components/PageParts'
import { Modal } from '../../components/Shell'

export function MePage(){const [leave,setLeave]=useState(false);return <main className="content two-column"><section><PageTitle eyebrow="계정과 저장 정보를 관리해요" title="내 정보"/><div className="card info-card"><h2>저장된 프로필</h2><dl><div><dt>학교 · 학과</dt><dd>서경대학교 · 메이크업디자인학과</dd></div><div><dt>학년</dt><dd>3학년 · 5학기 이수</dd></div><div><dt>사는 곳</dt><dd>서울특별시 성북구</dd></div></dl><Link className="link-button" to="/profile">프로필 수정하기 →</Link></div><div className="card account-card"><h2>계정 관리</h2><button>저장한 프로필 삭제</button><button className="danger" onClick={()=>setLeave(true)}>회원 탈퇴</button></div></section><ActionCard action={<Link className="button full" to="/">로그아웃</Link>}><h3>로그인 정보</h3><p>student@skuniv.ac.kr</p></ActionCard>{leave&&<Modal close={()=>setLeave(false)}><h2>정말 탈퇴할까요?</h2><p>저장한 프로필과 지망 정보가 모두 삭제되며 되돌릴 수 없어요.</p><div className="button-row center"><button className="button" onClick={()=>setLeave(false)}>취소</button><Link className="button danger-button" to="/">탈퇴하기</Link></div></Modal>}</main>}
