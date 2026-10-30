import { useCallback, useEffect, useRef, useState } from 'react'

// 페이지 전체 스크롤: 기본 스크롤바 대신 트랙 없이 둥근 막대만 보여 준다.
export function PageScrollBar() {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const [bar, setBar] = useState({ top: 0, height: 0, visible: false, percent: 0 })
  const update = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const viewport = window.innerHeight
    const total = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    const scrollRange = Math.max(0, total - viewport)
    const trackHeight = track.clientHeight
    const height = scrollRange > 0 ? Math.min(trackHeight, Math.max(42, trackHeight * viewport / total)) : 0
    const percent = scrollRange > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollRange)) : 0
    setBar({ top: percent * (trackHeight - height), height, visible: scrollRange > 1, percent: Math.round(percent * 100) })
  }, [])

  useEffect(() => {
    let frame = 0
    const schedule = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    observer.observe(document.documentElement)
    observer.observe(document.body)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [update])

  const startDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { y: event.clientY, scroll: window.scrollY }
  }
  const moveDrag = (event) => {
    if (!dragRef.current || !trackRef.current) return
    const travel = trackRef.current.clientHeight - bar.height
    const scrollRange = Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight)
    if (travel > 0) window.scrollTo({ top: dragRef.current.scroll + (event.clientY - dragRef.current.y) * scrollRange / travel, behavior: 'instant' })
  }
  const onKeyDown = (event) => {
    const scrollRange = Math.max(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight)
    const offsets = { ArrowDown: 60, ArrowUp: -60, PageDown: window.innerHeight * .9, PageUp: -window.innerHeight * .9 }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      window.scrollTo({ top: event.key === 'Home' ? 0 : scrollRange, behavior: 'instant' })
    } else if (event.key in offsets) {
      event.preventDefault()
      window.scrollBy({ top: offsets[event.key], behavior: 'instant' })
    }
  }

  return <div ref={trackRef} className={`page-scroll-track ${bar.visible ? 'is-visible' : ''}`}>
    {bar.visible && <span className="page-scroll-thumb" role="scrollbar" aria-label="페이지 스크롤" aria-controls="page-scroll-content" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bar.percent} tabIndex={0} style={{ height: bar.height, transform: `translateY(${bar.top}px)` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null }} onPointerCancel={() => { dragRef.current = null }} onLostPointerCapture={() => { dragRef.current = null }} onKeyDown={onKeyDown} />}
  </div>
}
