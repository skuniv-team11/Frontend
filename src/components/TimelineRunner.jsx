import { useEffect, useRef } from 'react'
import internshipRunner from '../assets/images/internship-runner.webm'
import './TimelineRunner.css'

export function TimelineRunner({ className = '' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!video || !canvas || !context) return undefined
    let frame = 0
    const draw = () => {
      if (video.readyState < 2) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = context.getImageData(0, 0, canvas.width, canvas.height)
      for (let index = 0; index < image.data.length; index += 4) {
        const brightness = Math.max(image.data[index], image.data[index + 1], image.data[index + 2])
        image.data[index + 3] = Math.round(image.data[index + 3] * Math.min(1, Math.max(0, (brightness - 8) / 32)))
      }
      context.putImageData(image, 0, 0)
    }
    const tick = () => { draw(); frame = window.requestAnimationFrame(tick) }
    const startDrawing = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(tick) }
    const stopDrawing = () => { window.cancelAnimationFrame(frame); draw() }
    const prepareFrame = () => {
      if (video.currentTime === 0 && Number.isFinite(video.duration) && video.duration > 0.15) video.currentTime = 0.15
      else draw()
    }
    const updatePlayback = () => {
      if (preference.matches) video.pause()
      else video.play().catch(() => {})
    }
    video.addEventListener('loadeddata', prepareFrame)
    video.addEventListener('seeked', draw)
    video.addEventListener('play', startDrawing)
    video.addEventListener('pause', stopDrawing)
    if (video.readyState >= 2) prepareFrame()
    updatePlayback()
    preference.addEventListener('change', updatePlayback)
    return () => {
      window.cancelAnimationFrame(frame)
      preference.removeEventListener('change', updatePlayback)
      video.removeEventListener('loadeddata', prepareFrame)
      video.removeEventListener('seeked', draw)
      video.removeEventListener('play', startDrawing)
      video.removeEventListener('pause', stopDrawing)
    }
  }, [])

  return <><video ref={videoRef} className="timeline-runner-source" src={internshipRunner} muted loop playsInline preload="auto" aria-hidden="true" /><canvas ref={canvasRef} className={className} width="128" height="72" aria-hidden="true" /></>
}
