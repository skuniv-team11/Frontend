import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getToken, resolveApiAssetUrl } from '../../api/client'
import { toProfileBody } from '../../api/matching'
import { getMyProfile } from '../../api/myInfo'
import { addPlanItem, checkPlan, getMyPlan, planErrorMessage, removePlanItem, saveRanks } from '../../api/plan'
import { getCodes } from '../../api/reference'
import { PageTitle } from '../../components/PageParts'
import { Badge } from '../../components/Shell'
import { PlanSignalNotice } from '../../components/PlanSignalNotice'
import { useRequest } from '../../hooks/useRequest'
import dragHandGrab from '../../assets/images/cursors/drag-hand-grab.png'
import dragHandOpen from '../../assets/images/cursors/drag-hand-open.png'
import hyundaiLogo from '../../assets/images/guide-companies/hyundai.svg'
import kakaoLogo from '../../assets/images/guide-companies/kakao.svg'
import lgLogo from '../../assets/images/guide-companies/lg.svg'
import naverLogo from '../../assets/images/guide-companies/naver.svg'
import samsungLogo from '../../assets/images/guide-companies/samsung.svg'
import guideScone from '../../assets/images/guide-scone-cutout.png'
import './PlanPage.css'

const verdictTone = { ELIGIBLE: 'green', NEEDS_CHECK: 'orange', INELIGIBLE: 'gray' }
const signalNoticeSnoozeKey = 'plan-signal-notice-snoozed-until'
const getSignalNoticeSnoozeKey = () => {
  const token=getToken()
  if(!token)return `${signalNoticeSnoozeKey}:anonymous`
  try{
    const encoded=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')
    const payload=JSON.parse(window.atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')))
    return `${signalNoticeSnoozeKey}:${payload.sub??payload.userId??'unknown'}`
  }catch{return `${signalNoticeSnoozeKey}:unknown`}
}
const formatDay = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`
const fallbackGuideJobs = [
  { jobId: 'guide-naver', title: '클라우드 서비스 운영 지원', institution: { name: 'NAVER', logoSrc: naverLogo } },
  { jobId: 'guide-kakao', title: '콘텐츠 서비스 기획', institution: { name: '카카오', logoSrc: kakaoLogo } },
  { jobId: 'guide-samsung', title: '데이터 분석 및 운영 지원', institution: { name: '삼성전자', logoSrc: samsungLogo } },
  { jobId: 'guide-lg', title: '사용자 경험 리서치 지원', institution: { name: 'LG전자', logoSrc: lgLogo } },
  { jobId: 'guide-hyundai', title: '디지털 마케팅 운영', institution: { name: '현대자동차', logoSrc: hyundaiLogo } },
]
const fallbackGuideSignals = Object.fromEntries(fallbackGuideJobs.map((job,index)=>[job.jobId,{status:'OPEN',interest:5-index,headcount:2+(index%2),closesOn:`2026-10-${String(18+index).padStart(2,'0')}`}]))
// closesOn은 '이 날부터 지원 불가'라서 화면에는 하루 전 날짜를 마감일로 보여 준다(백엔드 docs/api)
const dayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)

// 모집 신호 한 줄. 모집 상태는 모집 중 · 마감 두 가지만, 지원 의사가 정원보다 많아도 '몰림' 표시·경고는 하지 않는다(AGENTS.md, ADR-0015)
function SignalLine({ signal, label }) {
  return <div className="plan-signal"><Badge tone={signal.status === 'OPEN' ? 'green' : 'gray'}>{label('signalStatus', signal.status)}</Badge><span><b>관심 {signal.interest ?? signal.liveInterest ?? 0}명</b><small>정원 {signal.headcount ?? 0}명{signal.closesOn && ` · ${formatDay(dayBefore(signal.closesOn))} 마감${signal.closesOnIsVirtual ? '(가상)' : ''}`}</small></span></div>
}

const formatAddedAt = (value) => new Date(value).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function PlanInstitutionLogo({ institution, compact = false }) {
  const [failedSource,setFailedSource]=useState(null)
  const source=institution.logoSrc??resolveApiAssetUrl(institution.logoPath)
  const fallback=(institution.name?.trim()?.[0]??'기').toUpperCase()
  return <span className={`plan-institution-logo ${compact?'is-compact':''}`}>{source&&source!==failedSource?<img src={source} alt={`${institution.name} 로고`} onError={()=>setFailedSource(source)}/>:<b aria-hidden="true">{fallback}</b>}</span>
}

// 담은 직무 목록. 목록 순서가 곧 지망 순서다 — ↑↓로 바꾸면 위에서 3개를 1~3지망으로 정해 순위 전체를 보낸다(PUT ranks).
// 순서는 누르자마자 화면에 먼저 반영하고(실패하면 되돌림) 서버 응답으로 맞춘다. [빼기]는 담기 취소(DELETE) 뒤 그 직무만 목록에서 지운다 — 다시 불러오지 않는다. 지망 점검(POST check — 판정·모집 신호·빈 자리)은 다음 연동에서 붙인다.
const rankErrorMessage = (error) => {
  if (error.code === 'RANK_INVALID') return `순위를 정하지 못했어요. ${error.message}`
  if (error.code === 'NETWORK') return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.'
  if (error.status === 401) return '로그인 정보가 없거나 만료됐어요. 다시 로그인해 주세요.'
  return '순위를 정하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}
function PlanList({ plan, signals, label, onChanged, guiding = false, crowdedJobIds = [], swapJob = null, swapStage = null, onSwap }) {
  const navigate=useNavigate()
  const [removing, setRemoving] = useState(null); const [removeError, setRemoveError] = useState('')
  const [ranking, setRanking] = useState(false); const [rankError, setRankError] = useState('')
  const [draggingId,setDraggingId]=useState(null); const [dragTargetIndex,setDragTargetIndex]=useState(null)
  const dragOriginal=useRef(null); const dragOriginIndex=useRef(null); const dragMoved=useRef(false); const dragGesture=useRef(false)
  const dragTargetIndexRef=useRef(null)
  const dragPreview=useRef(null); const dragOffset=useRef({x:0,y:0}); const dragPointerY=useRef(0); const dragStart=useRef({x:0,y:0})
  const busy = removing !== null || ranking || Boolean(swapStage?.busy)
  const rankedItems=(ordered)=>ordered.map((item,index)=>({...item,rank:index<3?index+1:null}))
  const rankSignature=plan.data?.items.map(item=>`${item.jobId}:${item.rank??0}`).join('|')??''
  useEffect(()=>{
    if(!plan.data?.items.length)return
    const expected=plan.data.items.map((item,index)=>index<3?index+1:null)
    if(plan.data.items.every((item,index)=>(item.rank??null)===expected[index]))return
    let active=true
    const syncRanks=async()=>{
      setRanking(true);setRankError('')
      try{const updated=await saveRanks(plan.data.items.slice(0,3).map((item,index)=>({jobId:item.jobId,rank:index+1})));if(active){plan.mutate(updated);onChanged()}}
      catch(caught){if(active)setRankError(rankErrorMessage(caught))}
      finally{if(active)setRanking(false)}
    }
    syncRanks()
    return()=>{active=false}
    // 직무의 순서나 순위가 실제로 달라졌을 때만 자동 저장한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[rankSignature])
  const applyOrder = async (ordered) => {
    const previous = plan.data
    plan.mutate({ ...previous, items: rankedItems(ordered) })
    setRanking(true); setRankError('')
    try { plan.mutate(await saveRanks(ordered.slice(0, 3).map((item, index) => ({ jobId: item.jobId, rank: index + 1 })))); onChanged() }
    catch (caught) { plan.mutate(previous); setRankError(rankErrorMessage(caught)) }
    finally { setRanking(false) }
  }
  const move = (index, step) => {
    // 맨 위에서 ↑, 맨 아래에서 ↓는 바꿀 자리가 없으니 아무것도 하지 않는다
    if (index + step < 0 || index + step >= plan.data.items.length) return
    const ordered = [...plan.data.items]
    ;[ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]]
    applyOrder(ordered)
  }
  const remove = async (jobId) => {
    setRemoving(jobId); setRemoveError('')
    try { await removePlanItem(jobId); await new Promise(resolve=>window.setTimeout(resolve,360)); plan.mutate({ ...plan.data, items: plan.data.items.filter(item => item.jobId !== jobId) }); onChanged() }
    catch (caught) { setRemoveError(planErrorMessage(caught, '빼기')) }
    finally { setRemoving(null) }
  }
  const animateReorder=(update)=>{
    const before=new Map([...document.querySelectorAll('.pick-list .plan-pick:not(.is-dragging)')].map(element=>[element.dataset.jobId,element.getBoundingClientRect()]))
    flushSync(update)
    document.querySelectorAll('.pick-list .plan-pick:not(.is-dragging)').forEach(element=>{
      const previous=before.get(element.dataset.jobId);if(!previous)return
      const current=element.getBoundingClientRect();const x=previous.left-current.left;const y=previous.top-current.top
      if(x||y)element.animate([{transform:`translate(${x}px, ${y}px)`},{transform:'translate(0, 0)'}],{duration:360,easing:'cubic-bezier(.22, 1, .36, 1)'})
    })
  }
  const removeDragPreview=()=>{
    dragPreview.current?.remove();dragPreview.current=null
  }
  const orderAtDragTarget=(items,targetIndex)=>{
    if(draggingId===null||targetIndex===null)return items
    const ordered=[...items];const from=ordered.findIndex(item=>String(item.jobId)===String(draggingId))
    if(from<0)return items
    const [dragged]=ordered.splice(from,1);ordered.splice(Math.max(0,Math.min(targetIndex,ordered.length)),0,dragged)
    return ordered
  }
  const updatePreviewRank=(index)=>{
    if(!dragPreview.current)return
    const rank=index<3?index+1:null;const number=dragPreview.current.querySelector('.plan-rank span');const name=dragPreview.current.querySelector('.plan-rank b')
    if(number)number.textContent=rank??'·';if(name)name.textContent=rank?'지망':'후보'
    dragPreview.current.classList.toggle('is-ranked',Boolean(rank));dragPreview.current.classList.toggle('is-candidate',!rank)
  }
  const startDrag=(event,item)=>{
    if(busy||swapJob||event.button!==0||event.target.closest('button'))return
    const origin=plan.data.items.findIndex(entry=>String(entry.jobId)===String(item.jobId))
    dragOriginal.current=plan.data;dragOriginIndex.current=origin;dragTargetIndexRef.current=origin;dragMoved.current=false;dragGesture.current=false;dragStart.current={x:event.clientX,y:event.clientY};setDraggingId(item.jobId);setDragTargetIndex(origin)
    event.currentTarget.setPointerCapture(event.pointerId)
    const bounds=event.currentTarget.getBoundingClientRect();dragOffset.current={x:event.clientX-bounds.left,y:event.clientY-bounds.top};dragPointerY.current=event.clientY
    const preview=event.currentTarget.cloneNode(true);preview.classList.remove('is-dragging');preview.classList.add('plan-drag-preview');preview.style.width=`${bounds.width}px`;preview.style.height=`${bounds.height}px`
    preview.setAttribute('aria-hidden','true');document.body.appendChild(preview);dragPreview.current=preview
    preview.style.left=`${event.clientX-dragOffset.current.x}px`;preview.style.top=`${event.clientY-dragOffset.current.y}px`
  }
  const followDrag=(event)=>{
    if(!dragPreview.current)return
    if(Math.hypot(event.clientX-dragStart.current.x,event.clientY-dragStart.current.y)>=5)dragGesture.current=true
    dragPreview.current.style.left=`${event.clientX-dragOffset.current.x}px`;dragPreview.current.style.top=`${event.clientY-dragOffset.current.y}px`
    const previewBounds=dragPreview.current.getBoundingClientRect()
    const cards=[...document.querySelectorAll('.pick-list .plan-pick:not(.is-dragging)')]
    const currentTarget=dragTargetIndexRef.current
    let to=currentTarget
    const movingDown=event.clientY>dragPointerY.current;const movingUp=event.clientY<dragPointerY.current;dragPointerY.current=event.clientY
    if(movingDown)while(to<cards.length){const bounds=cards[to].getBoundingClientRect();if(previewBounds.bottom<=bounds.top+bounds.height/2)break;to+=1}
    if(movingUp)while(to>0){const bounds=cards[to-1].getBoundingClientRect();if(previewBounds.top>=bounds.top+bounds.height/2)break;to-=1}
    if(to===currentTarget)return
    dragTargetIndexRef.current=to
    dragMoved.current=to!==dragOriginIndex.current;updatePreviewRank(to)
    animateReorder(()=>setDragTargetIndex(to))
  }
  const dropDraggedItem=async(event)=>{
    if(dragOriginIndex.current===null)return
    if(event.currentTarget.hasPointerCapture?.(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
    const previous=dragOriginal.current;dragOriginal.current=null
    const ordered=orderAtDragTarget(plan.data.items,dragTargetIndexRef.current);setDraggingId(null);setDragTargetIndex(null);removeDragPreview()
    if(!dragMoved.current){dragOriginIndex.current=null;dragTargetIndexRef.current=null;window.setTimeout(()=>{dragGesture.current=false},0);return}
    plan.mutate({...plan.data,items:rankedItems(ordered)});dragOriginIndex.current=null;dragTargetIndexRef.current=null
    setRanking(true);setRankError('')
    try{plan.mutate(await saveRanks(ordered.slice(0,3).map((item,index)=>({jobId:item.jobId,rank:index+1}))));onChanged()}
    catch(caught){if(previous)plan.mutate(previous);setRankError(rankErrorMessage(caught))}
    finally{setRanking(false);window.setTimeout(()=>{dragMoved.current=false;dragGesture.current=false},0)}
  }
  const endDrag=()=>{
    setDraggingId(null);setDragTargetIndex(null);removeDragPreview()
    dragOriginal.current=null;dragOriginIndex.current=null;dragTargetIndexRef.current=null;window.setTimeout(()=>{dragMoved.current=false;dragGesture.current=false},0)
  }
  if (!getToken()) return <div className="plan-state"><span className="plan-state-icon">🔒</span><h2>로그인하면 내 지망을 만들 수 있어요</h2><Link className="plan-primary-link" to="/login">로그인하러 가기</Link></div>
  if (plan.loading) return <div className="plan-state" role="status"><i className="plan-loading-spinner"/><h2>담은 직무를 불러오고 있어요</h2><p>서버를 깨우는 중이면 1분 가까이 걸릴 수 있어요.</p></div>
  if (plan.error?.code === 'FORBIDDEN_ROLE') return <div className="plan-state"><h2>내 지망은 학생 계정에서만 쓸 수 있어요</h2></div>
  if (plan.error?.status === 401) return <div className="plan-state"><h2>로그인 정보가 만료됐어요</h2><Link className="plan-primary-link" to="/login">다시 로그인하기</Link></div>
  if (plan.error) return <div className="plan-state"><h2>담은 직무를 불러오지 못했어요</h2><button className="plan-secondary-button" onClick={plan.reload}>다시 불러오기</button></div>
  if (!plan.data.items.length&&!guiding) return <div className="plan-state"><Link className="plan-state-icon plan-state-add" to="/jobs" aria-label="직무 찾기로 이동">＋</Link><h2>아직 담은 직무가 없어요</h2></div>
  const items = plan.data.items
  const guideDisplayItems=fallbackGuideJobs.map(item=>({...item,addedAt:'2026-10-01T09:00:00Z'}))
  const displayItems=guiding?guideDisplayItems:orderAtDragTarget(items,dragTargetIndex)
  const dragGuideJobs=displayItems
  return <section className="plan-board">{(removeError || rankError) && <p className="plan-error" role="alert">{removeError || rankError}</p>}<div className="plan-board-toolbar"><h2>담은 직무</h2>{ranking&&<small className="plan-saving">순서를 저장하는 중…</small>}</div><div className="pick-list">{displayItems.map((item,index)=>{const rank=index<3?index+1:null;const shownItem=guiding&&index<2?{...item,...dragGuideJobs[index]}:item;const crowded=crowdedJobIds.includes(item.jobId);const swapping=String(swapStage?.leavingId)===String(item.jobId);const entering=String(swapStage?.enteringId)===String(item.jobId);const openItem=()=>{if(swapJob&&!busy){onSwap(item,index);return}if(!guiding&&!dragGesture.current)navigate(`/jobs/${item.jobId}`,{state:{returnScrollY:window.scrollY}})};return <article className={`plan-pick ${rank?'is-ranked':'is-candidate'} ${crowded?'is-crowded':''} ${guiding&&index<2?'is-guide-example':''} ${String(draggingId)===String(item.jobId)?'is-dragging':''} ${String(removing)===String(item.jobId)?'is-removing':''} ${swapping?'is-swap-leaving':''} ${entering?'is-swap-entering':''}`} data-job-id={item.jobId} role="button" tabIndex="0" style={{'--pick-index':index}} key={item.jobId} onClick={openItem} onKeyDown={event=>{if(event.target===event.currentTarget&&(event.key==='Enter'||event.key===' ')){event.preventDefault();openItem()}}} onPointerDown={event=>startDrag(event,item)} onPointerMove={followDrag} onPointerUp={dropDraggedItem} onPointerCancel={endDrag}><span className="plan-drag-handle" aria-hidden="true">⠿</span>{swapJob&&<span className="plan-swap-hover" aria-hidden="true">⇄</span>}{crowded&&!guiding&&<span className="plan-crowded-tooltip" role="tooltip">관심이 몰리는 지망이에요.</span>}<div className="plan-rank"><span className={guiding&&index<2?'is-guide-rank':''}>{guiding&&index<2?<><i className="rank-before">{rank}</i><i className="rank-after">{index===0?2:1}</i></>:rank??'·'}</span><b>{rank?'지망':'후보'}</b></div><div className="plan-pick-main"><PlanInstitutionLogo institution={shownItem.institution}/><div className="plan-pick-copy"><small>{shownItem.institution.name}</small><h3>{shownItem.title}</h3>{guiding&&index<2?<p className="plan-added-at">순서 변경 안내용 예시 직무</p>:signals[item.jobId]?<SignalLine signal={signals[item.jobId]} label={label}/>:<p className="plan-added-at">{formatAddedAt(item.addedAt)}에 담았어요</p>}</div></div><div className="plan-order-actions"><button disabled={busy||Boolean(swapJob)||index===0} aria-label={`${shownItem.title} 순서를 위로`} onClick={event=>{event.stopPropagation();move(index,-1)}}>↑</button><button disabled={busy||Boolean(swapJob)||index===displayItems.length-1} aria-label={`${shownItem.title} 순서를 아래로`} onClick={event=>{event.stopPropagation();move(index,1)}}>↓</button></div><div className="plan-pick-actions"><button disabled={busy||Boolean(swapJob)||guiding} onClick={event=>{event.stopPropagation();remove(item.jobId)}}>{removing===item.jobId?'빼는 중…':'빼기'}</button></div></article>})}{guiding&&displayItems.length>1&&<span className="plan-guide-live-pointer" aria-hidden="true"><span className="plan-guide-hand"><img className="is-open" src={dragHandOpen} alt=""/><img className="is-grab" src={dragHandGrab} alt=""/></span><b>잡고 이동</b></span>}<Link className="plan-add-candidate" to="/jobs" aria-label="후보 직무 더 담기"><span aria-hidden="true">＋</span></Link></div></section>
}

function AlternativePreviewSheet({ job, label, close, onStartSwap }) {
  const [closing,setClosing]=useState(false)
  const panelRef=useRef(null)
  const closeTimer=useRef(null)
  const dragState=useRef({active:false,startY:0,offset:0})
  const requestClose=useCallback(()=>{
    if(closing)return
    setClosing(true);window.clearTimeout(closeTimer.current)
    closeTimer.current=window.setTimeout(close,360)
  },[close,closing])
  const requestCloseRef=useRef(requestClose)
  useEffect(()=>{requestCloseRef.current=requestClose},[requestClose])
  useEffect(()=>{
    const previousOverflow=document.body.style.overflow
    const closeOnEscape=(event)=>{if(event.key==='Escape')requestCloseRef.current()}
    document.body.style.overflow='hidden';window.addEventListener('keydown',closeOnEscape)
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape);window.clearTimeout(closeTimer.current)}
  },[])
  const startDrag=(event)=>{
    if(closing||event.button!==0||event.target.closest('button,a'))return
    dragState.current={active:true,startY:event.clientY,offset:0};event.currentTarget.setPointerCapture(event.pointerId)
    panelRef.current?.classList.add('is-dragging','has-dragged')
  }
  const moveDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    const offset=Math.max(-70,event.clientY-dragState.current.startY);dragState.current.offset=offset
    panelRef.current.style.setProperty('--sheet-drag-y',`${offset}px`);panelRef.current.style.transform=`translateY(${offset}px)`
  }
  const endDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    dragState.current.active=false;event.currentTarget.releasePointerCapture?.(event.pointerId)
    const panel=panelRef.current;panel.classList.remove('is-dragging')
    if(dragState.current.offset>=panel.getBoundingClientRect().height*.2){requestClose();return}
    panel.classList.add('is-settling');panel.style.transform='translateY(0)';panel.style.setProperty('--sheet-drag-y','0px')
    window.setTimeout(()=>panel.classList.remove('is-settling'),300)
  }
  const rememberOpenSheet=()=>window.history.replaceState({...window.history.state,usr:{...(window.history.state?.usr??{}),reopenAlternativeId:job.jobId}},'')
  const startSwap=()=>{requestClose();window.setTimeout(()=>onStartSwap(job),370)}
  return createPortal(<div className={`plan-alternative-sheet-overlay ${closing?'is-closing':''}`} onMouseDown={event=>{if(event.target===event.currentTarget)requestClose()}}><section ref={panelRef} className="plan-alternative-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-alternative-sheet-title" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><button type="button" className="plan-alternative-sheet-grip" aria-label="패널을 위아래로 움직이기"/><button type="button" className="plan-alternative-sheet-close" aria-label="닫기" onClick={requestClose}>×</button><div className="plan-alternative-sheet-heading"><div><span>빈 자리 제안</span><h2 id="plan-alternative-sheet-title">이 직무를 추천하는 이유</h2></div><div><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge><Badge>적합도 {label('fit',job.fit)}</Badge></div></div><div className="plan-alternative-sheet-job"><small>{job.institution.name}</small><h3>{job.title}</h3><p>{job.why||'내 조건과 비슷한 직무 중 지금 지원할 수 있는 자리가 남아 있어요.'}</p></div><dl className="plan-alternative-sheet-info"><div><dt>지원 판정</dt><dd>{label('verdict',job.verdict)}</dd></div><div><dt>적합도</dt><dd>{label('fit',job.fit)}</dd></div><div><dt>모집 정보</dt><dd>남은 자리 {job.remaining}개 · {label('signalStatus',job.signal?.status)}</dd></div></dl><div className="plan-alternative-sheet-actions"><Link to={`/jobs/${job.jobId}`} state={{returnScrollY:window.scrollY,reopenAlternativeId:job.jobId}} onClick={rememberOpenSheet}>직무 상세 보기</Link><button type="button" onClick={startSwap}>지망 교체하기</button></div></section></div>,document.body)
}

// 지망 점검 응답의 빈 자리 제안, 최대 5개
function Alternatives({ check, profile, label, initialSelectedId = null, onStartSwap }) {
  const [selectedId,setSelectedId]=useState(initialSelectedId)
  if (profile.error?.code === 'PROFILE_NOT_FOUND') return <p>프로필을 저장하면 내 조건으로 자리가 남은 직무를 찾아 드려요. <Link className="link-button" to="/profile">프로필 입력하기 →</Link></p>
  if (profile.loading || (check.loading && !check.data)) return <p>모집 신호를 확인하는 중…</p>
  if (check.error || profile.error) return <p>모집 신호를 불러오지 못했어요. <button className="link-button" onClick={check.reload}>다시 불러오기</button></p>
  if (!check.data) return null
  if (!check.data.alternatives.length) return <p>지금 기준으로 자리가 남은 비슷한 직무가 없어요.</p>
  const selectedJob=check.data.alternatives.find(job=>String(job.jobId)===String(selectedId))
  return <><div className="plan-alternatives">{check.data.alternatives.map(job=>{const selected=String(selectedId)===String(job.jobId);const toggle=()=>setSelectedId(selected?null:job.jobId);return <div className={`plan-alternative-wrap ${selected?'is-open':''}`} key={job.jobId}><article className="plan-alternative" role="button" tabIndex="0" aria-expanded={selected} onClick={toggle} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}}}><PlanInstitutionLogo institution={job.institution} compact/><div className="plan-alternative-copy"><small>{job.institution.name}</small><b>{job.title}</b><div className="plan-alternative-meta"><Badge tone={verdictTone[job.verdict]}>{label('verdict',job.verdict)}</Badge><span>남은 자리 {job.remaining}개</span></div></div></article></div>})}</div>{selectedJob&&<AlternativePreviewSheet job={selectedJob} label={label} close={()=>setSelectedId(null)} onStartSwap={onStartSwap}/>}</>
}

function PlanPrintSheet({ plan, signals }) {
  const items=plan.data?.items??[]
  return <section className="plan-print-sheet" aria-hidden="true"><header><div><span>MY PRIORITY</span><h1>담은 직무</h1></div><p>총 {items.length}개</p></header><div className="plan-print-grid">{items.map((item,index)=>{const signal=signals[item.jobId];return <article key={item.jobId}><div className="plan-print-card-top"><PlanInstitutionLogo institution={item.institution}/><div><small>{item.institution.name}</small><h2>{item.title}</h2></div><b>{index<3?`${index+1}지망`:'후보'}</b></div>{signal&&<p><span>{signal.status==='OPEN'?'모집 중':'마감'}</span> 관심 {signal.interest??signal.liveInterest??0}명 · 정원 {signal.headcount??0}명</p>}</article>})}</div></section>
}

const preparationItems = ['이력서 최신 내용 확인','학교 현장실습 신청서','개인정보 수집·이용 동의서','담당 교수 확인']

function PlanToolPanel({ type, plan, signals, onClose, closing, guidePreview = false, guideClosing = false }) {
  const panelRef=useRef(null)
  const dragState=useRef({active:false,startY:0,offset:0})
  const startPanelDrag=(event)=>{
    if(closing||guidePreview)return
    const control=event.target.closest('button, input, label, a')
    if(control&&!control.classList.contains('plan-tool-grip'))return
    dragState.current={active:true,startY:event.clientY,offset:0};event.currentTarget.setPointerCapture(event.pointerId)
    panelRef.current?.classList.add('is-dragging','has-dragged')
  }
  const movePanelDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    const offset=Math.max(-70,event.clientY-dragState.current.startY);dragState.current.offset=offset
    panelRef.current.style.setProperty('--sheet-drag-y',`${offset}px`);panelRef.current.style.transform=`translateY(${offset}px)`
  }
  const endPanelDrag=(event)=>{
    if(!dragState.current.active||!panelRef.current)return
    dragState.current.active=false;event.currentTarget.releasePointerCapture?.(event.pointerId)
    const panel=panelRef.current;panel.classList.remove('is-dragging')
    if(dragState.current.offset>=panel.getBoundingClientRect().height*.2){onClose();return}
    panel.classList.add('is-settling');panel.style.transform='translateY(0)';panel.style.setProperty('--sheet-drag-y','0px')
    window.setTimeout(()=>panel.classList.remove('is-settling'),300)
  }
  const choices=guidePreview?fallbackGuideJobs.map((item,index)=>({...item,rank:index<3?index+1:null})):[...(plan.data?.items??[])].sort((a,b)=>(a.rank??99)-(b.rank??99)).slice(0,3)
  const displayedSignals=guidePreview?fallbackGuideSignals:signals
  const printPlan=()=>{document.body.classList.add('printing-plan');try{window.print()}finally{document.body.classList.remove('printing-plan')}}
  const panel = type==='apply' ? (() => {
    const closingDays=choices.map(item=>displayedSignals[item.jobId]?.closesOn).filter(Boolean).sort()
    return <><div className="plan-tool-heading"><div><span>APPLICATION CHECK</span><h2 id="plan-tool-title">지원 전에 준비물을 확인하세요</h2></div>{closingDays[0]&&<div className="plan-tool-deadline"><small>가장 빠른 마감</small><b>{formatDay(dayBefore(closingDays[0]))}</b></div>}</div><div className="plan-check-grid">{preparationItems.map((item,index)=><label key={item}><input type="checkbox" defaultChecked={index===0}/><span><b>{item}</b><small>{index===0?'확인했어요':'학교 포털에서 준비해 주세요'}</small></span></label>)}</div><p className="plan-tool-note">현장뛰자는 신청서를 대신 작성하거나 제출하지 않아요. 학교 현장실습 포털에서 직접 제출해 주세요.</p></>
  })() : <><div className="plan-tool-heading"><div><span>COUNSELING NOTE</span><h2 id="plan-tool-title">상담에 가져갈 지망 요약</h2></div><button type="button" onClick={printPlan}>인쇄하기</button></div><div className="plan-counsel-list">{choices.map((item,index)=>{const signal=displayedSignals[item.jobId];const candidateNumber=guidePreview?index-2:index+1;return <article key={item.jobId}><b>{item.rank?`${item.rank}지망`:`후보 ${candidateNumber}`}</b><div><small>{item.institution.name}</small><h3>{item.title}</h3><p>{signal?`현재 관심 ${signal.interest??signal.liveInterest??0}명이고 정원은 ${signal.headcount??0}명이에요.`:'상세 화면에서 지원 조건과 하는 일을 함께 확인해 보세요.'}</p></div></article>})}</div><div className="plan-counsel-questions"><b>상담할 때 물어볼 것</b><span>이 직무가 희망 진로와 어떻게 이어지나요?</span><span>지원 전에 더 준비할 경험이 있나요?</span></div></>
  return createPortal(<div className={`plan-tool-overlay ${closing?'is-closing':''} ${guidePreview?'is-guide-preview':''} ${guideClosing?'is-guide-closing':''}`} onMouseDown={event=>{if(!guidePreview&&event.target===event.currentTarget)onClose()}}><section ref={panelRef} className="plan-tool-panel" role="dialog" aria-modal="true" aria-labelledby="plan-tool-title" onPointerDown={startPanelDrag} onPointerMove={movePanelDrag} onPointerUp={endPanelDrag} onPointerCancel={endPanelDrag}><button className="plan-tool-grip" type="button" aria-label="패널을 위아래로 움직이기"/><button className="plan-tool-close" type="button" aria-label="닫기" onClick={onClose}>×</button>{panel}{guidePreview&&<span className="plan-tool-bottom-shade" aria-hidden="true"/>}</section></div>,document.body)
}

export function PlanPage(){
  const location=useLocation()
  const reopenAlternativeId=location.state?.reopenAlternativeId
  useEffect(()=>{
    if(reopenAlternativeId==null)return
    const currentState=window.history.state??{}
    const currentUserState={...(currentState.usr??{})}
    delete currentUserState.reopenAlternativeId
    window.history.replaceState({...currentState,usr:currentUserState},'')
  },[reopenAlternativeId])
  const loggedIn=Boolean(getToken())
  const plan=useRequest(getMyPlan,loggedIn)
  const profile=useRequest(getMyProfile,loggedIn)
  const codes=useRequest(getCodes)
  const [signalNoticeClosed,setSignalNoticeClosed]=useState(()=>{
    try{return Number(window.localStorage.getItem(getSignalNoticeSnoozeKey()))>Date.now()}
    catch{return false}
  })
  const [activeTool,setActiveTool]=useState(null)
  const [showDragGuide,setShowDragGuide]=useState(false)
  const [guideStep,setGuideStep]=useState(0)
  const [guideTransitioning,setGuideTransitioning]=useState(false)
  const [guideClosing,setGuideClosing]=useState(false)
  const [swapJob,setSwapJob]=useState(null)
  const [swapStage,setSwapStage]=useState(null)
  const [swapError,setSwapError]=useState('')
  const guideTransitionTimer=useRef(null)
  const closeDragGuide=useCallback(()=>{setShowDragGuide(false);setActiveTool(null)},[])
  useEffect(()=>{
    if(!showDragGuide||!plan.data)return undefined
    const previousBodyOverflow=document.body.style.overflow
    const previousRootOverflow=document.documentElement.style.overflow
    const closeOnEscape=(event)=>{if(event.key==='Escape'&&guideStep<3)closeDragGuide()}
    document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';window.addEventListener('keydown',closeOnEscape)
    return()=>{document.body.style.overflow=previousBodyOverflow;document.documentElement.style.overflow=previousRootOverflow;window.removeEventListener('keydown',closeOnEscape)}
  },[showDragGuide,plan.data,guideStep,closeDragGuide])
  const [toolClosing,setToolClosing]=useState(false)
  const closeTimer=useRef(null)
  const openTool=(type)=>{window.clearTimeout(closeTimer.current);setToolClosing(false);setActiveTool(type)}
  const closeTool=useCallback(()=>{
    if(!activeTool||toolClosing)return
    setToolClosing(true)
    closeTimer.current=window.setTimeout(()=>{setActiveTool(null);setToolClosing(false)},360)
  },[activeTool,toolClosing])
  useEffect(()=>{
    // 가이드가 열려 있을 때는 위의 가이드 effect가 스크롤 잠금을 단독으로 관리한다.
    // 두 effect가 각각 이전 overflow 값을 복원하면 종료 순서에 따라 hidden이 남을 수 있다.
    if(!activeTool||showDragGuide)return undefined
    const previousOverflow=document.body.style.overflow
    const closeOnEscape=(event)=>{if(event.key==='Escape')closeTool()}
    document.body.style.overflow='hidden';window.addEventListener('keydown',closeOnEscape)
    return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape)}
  },[activeTool,showDragGuide,closeTool])
  useEffect(()=>()=>{window.clearTimeout(closeTimer.current);window.clearTimeout(guideTransitionTimer.current)},[])
  const label=(group,value)=>codes.data?.[group]?.[value]??value
  // 지망 점검. 프로필은 본문으로만 보낸다. 순위를 바꾸거나 직무를 빼면 PlanList가 onChanged로 다시 부른다
  const profileBody=useMemo(()=>profile.data?toProfileBody(profile.data):null,[profile.data])
  const loadCheck=useCallback((signal)=>checkPlan(profileBody,signal),[profileBody])
  const check=useRequest(loadCheck,Boolean(profileBody&&plan.data))
  const signals=Object.fromEntries([
    ...(plan.data?.items??[]).filter(item=>item.signal).map(item=>[item.jobId,item.signal]),
    ...(check.data?.alternatives??[]).filter(item=>item.signal).map(item=>[item.jobId,item.signal]),
    ...(check.data?.items??[]).filter(item=>item.signal).map(item=>[item.jobId,item.signal]),
  ])
  const dragGuideActive=Boolean(showDragGuide&&plan.data)
  const isCrowdedSignal=(signal)=>Boolean(signal?.crowded||signal?.isCrowded||signal?.overCapacity||((signal?.ratio??0)>1))
  const crowdedItems=(check.data?.items??[]).filter(item=>isCrowdedSignal(item.signal))
  const crowdedJobIds=crowdedItems.flatMap(item=>[item.jobId,String(item.jobId)])
  const signalNoticeActive=!dragGuideActive&&!signalNoticeClosed&&crowdedItems.length>0
  const swapPlanItem=async(item,index)=>{
    if(!swapJob||swapStage?.busy)return
    const previous=plan.data
    setSwapError('');setSwapStage({busy:true,leavingId:item.jobId})
    await new Promise(resolve=>window.setTimeout(resolve,360))
    try{
      await addPlanItem(swapJob.jobId)
      await removePlanItem(item.jobId)
      let updated
      if(index<3){
        const ranks=previous.items.slice(0,3).map((entry,rankIndex)=>({jobId:rankIndex===index?swapJob.jobId:entry.jobId,rank:rankIndex+1}))
        updated=await saveRanks(ranks)
      }else{
        updated=await getMyPlan()
      }
      const replacement=updated.items.find(entry=>String(entry.jobId)===String(swapJob.jobId))??{...swapJob,rank:index<3?index+1:null,addedAt:new Date().toISOString()}
      const reordered=updated.items.filter(entry=>String(entry.jobId)!==String(swapJob.jobId))
      reordered.splice(Math.min(index,reordered.length),0,replacement)
      plan.mutate({...updated,items:reordered});setSwapStage({busy:true,enteringId:swapJob.jobId});check.reload()
      window.setTimeout(()=>{setSwapJob(null);setSwapStage(null)},620)
    }catch(caught){
      plan.mutate(previous);setSwapStage(null);setSwapError(planErrorMessage(caught,'담기'))
    }
  }
  const guideChecklistStep=dragGuideActive&&guideStep===3
  const guideCounselStep=dragGuideActive&&guideStep===4
  const guideToolStep=guideChecklistStep||guideCounselStep
  const guideMessages=['담아 둔 직무를 한눈에 확인할 수 있어요.','현장실습은 최대 3개 직무를 지원할 수 있어요.','카드를 끌어 원하는 지망 순서를 변경할 수 있어요.','체크리스트에서 지원 준비를 확인할 수 있어요.','상담 요약에서 상담에 필요한 내용을 확인할 수 있어요.']
  const advanceGuide=()=>{
    if(guideTransitioning||guideClosing)return
    if(guideStep===4){
      setGuideClosing(true)
      window.clearTimeout(guideTransitionTimer.current)
      guideTransitionTimer.current=window.setTimeout(()=>{setShowDragGuide(false);setActiveTool(null);setGuideClosing(false)},520)
      return
    }
    setGuideTransitioning(true)
    window.clearTimeout(guideTransitionTimer.current)
    guideTransitionTimer.current=window.setTimeout(()=>{
      const nextStep=guideStep+1;setGuideStep(nextStep);if(nextStep===3)openTool('apply');if(nextStep===4)openTool('counsel');setGuideTransitioning(false)
    },260)
  }
  return <main className={`plan-page ${signalNoticeActive?'has-signal-notice':''} ${swapJob?'is-swap-mode':''} ${dragGuideActive?`is-drag-guiding is-guide-step-${guideStep} ${guideTransitioning?'is-guide-transitioning':''} ${guideClosing?'is-guide-closing':''}`:''}`}>
    <div className="plan-page-inner">
      <header className="plan-heading"><PageTitle eyebrow="MY PRIORITY" title="내 지망을 한눈에 점검해 보세요"/>{plan.data&&<div className="plan-summary"><div><small>담은 직무</small><b>{plan.data.items.length}</b></div></div>}</header>
      <div className="plan-layout"><div>
        {plan.data&&createPortal(<button className={`plan-guide-open ${dragGuideActive?'is-guide-disabled':''} ${guideClosing?'is-guide-closing':''}`} type="button" disabled={dragGuideActive} aria-hidden={dragGuideActive||undefined} onClick={()=>{setActiveTool(null);setGuideStep(0);setShowDragGuide(true)}}><img src={guideScone} alt="" aria-hidden="true"/><span aria-hidden="true">i</span><b>가이드</b></button>,document.body)}
        {dragGuideActive&&(guideToolStep?createPortal(<p className={`plan-guide-title is-overlay ${guideClosing?'is-closing':''}`}>{guideMessages[guideStep]}</p>,document.body):<p className="plan-guide-title">{guideMessages[guideStep]}</p>)}
        {swapError&&<p className="plan-error" role="alert">{swapError}</p>}<PlanList key={dragGuideActive?`guide-step-${guideStep}`:'plan-list'} plan={plan} signals={signals} label={label} onChanged={check.reload} guiding={dragGuideActive} crowdedJobIds={crowdedJobIds} swapJob={swapJob} swapStage={swapStage} onSwap={swapPlanItem}/>
        {dragGuideActive&&createPortal(<><div className={`plan-guide-inline ${guideClosing?'is-closing':''}`}><button type="button" disabled={guideTransitioning} onClick={advanceGuide}>{guideStep<4?'다음':'완료'}{guideStep<4&&<span aria-hidden="true">→</span>}</button></div>{!guideToolStep&&<button className="plan-guide-dismiss" type="button" onClick={closeDragGuide}>그만보기 <span aria-hidden="true">×</span></button>}</>,document.body)}
        {plan.data?.items.length>0&&<p className="plan-simulation">※ 모집 신호는 시연을 위한 가상 데이터예요.</p>}{plan.data&&createPortal(<div className={`plan-footer-actions ${dragGuideActive&&!guideToolStep?'is-guide-disabled':''} ${guideChecklistStep?'is-guide-checklist':''} ${guideCounselStep?'is-guide-counsel':''} ${guideClosing?'is-guide-closing':''}`} aria-hidden={dragGuideActive||undefined}><button type="button" className={`plan-apply-tool ${activeTool==='apply'?'is-active':''}`} disabled={dragGuideActive} aria-expanded={activeTool==='apply'} onClick={()=>activeTool==='apply'?closeTool():openTool('apply')}><span aria-hidden="true">✓</span><b>체크리스트</b></button><button type="button" className={`plan-counsel-tool ${activeTool==='counsel'?'is-active':''}`} disabled={dragGuideActive} aria-expanded={activeTool==='counsel'} onClick={()=>activeTool==='counsel'?closeTool():openTool('counsel')}><span aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M4 16V10M10 16V5M16 16V8"/></svg></span><b>상담 요약</b></button>{guideToolStep&&<span className={`plan-guide-checklist-arrow ${guideCounselStep?'is-counsel':''}`} aria-hidden="true"><i>↘</i></span>}</div>,document.body)}{activeTool&&<PlanToolPanel key={activeTool} type={activeTool} plan={plan} signals={signals} onClose={closeTool} closing={toolClosing} guidePreview={guideToolStep} guideClosing={guideClosing}/>} 
      </div><aside className="plan-side"><section><div className="plan-side-heading"><h2>비슷한 빈 자리</h2></div><Alternatives check={check} profile={profile} label={label} initialSelectedId={reopenAlternativeId} onStartSwap={job=>{setSwapError('');setSwapJob(job)}}/></section></aside></div>
    </div>
    <PlanPrintSheet plan={plan} signals={signals}/>{signalNoticeActive&&<PlanSignalNotice items={crowdedItems} close={()=>setSignalNoticeClosed(true)} snooze={()=>{try{window.localStorage.setItem(getSignalNoticeSnoozeKey(),String(Date.now()+86400000))}catch{/* 저장할 수 없어도 현재 안내는 닫는다. */}setSignalNoticeClosed(true)}}/>}{swapJob&&createPortal(<><p className="plan-swap-instruction">교체할 직무를 선택하세요</p><aside className="plan-swap-candidate"><button type="button" aria-label="교체 취소" onClick={()=>setSwapJob(null)}>×</button><span>교체할 빈 자리</span><small>{swapJob.institution.name}</small><b>{swapJob.title}</b><em>남은 자리 {swapJob.remaining}개</em></aside></>,document.body)} {dragGuideActive&&<><div className="plan-guide-backdrop"/><div className="plan-guide-bottom-shade"/></>}
  </main>
}
