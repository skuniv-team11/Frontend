import { useEffect, useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { getScrollPosition, saveScrollPosition, takeScrollRestoreRequest } from './scrollPosition'
import './RootLayout.css'

export function RootLayout({ center = false }) {
  const location = useLocation()
  const isLogin = location.pathname === '/login'
  const isHome = location.pathname === '/'

  useEffect(() => {
    const previous = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => { window.history.scrollRestoration = previous }
  }, [])

  useLayoutEffect(() => {
    const restoreRequest = takeScrollRestoreRequest()
    const shouldRestore = restoreRequest.requested
    const savedTop = restoreRequest.top ?? getScrollPosition(location.key)
    let frame
    let retryTimer
    let expiryTimer
    let resizeObserver
    let cancelled = false
    const restore = () => {
      if (cancelled) return
      window.scrollTo({ top: savedTop, left: 0, behavior: 'auto' })
      if (Math.abs(window.scrollY - savedTop) <= 2) stopRetrying()
    }
    const stopRetrying = () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      window.clearInterval(retryTimer)
      window.clearTimeout(expiryTimer)
      resizeObserver?.disconnect()
    }
    const cancelPendingRestore = () => stopRetrying()

    if (shouldRestore) {
      restore()
      if (!cancelled) {
        frame = window.requestAnimationFrame(restore)
        retryTimer = window.setInterval(restore, 120)
        expiryTimer = window.setTimeout(stopRetrying, 60000)
        resizeObserver = new ResizeObserver(restore)
        resizeObserver.observe(document.documentElement)
        resizeObserver.observe(document.body)
        window.addEventListener('wheel', cancelPendingRestore, { once: true, passive: true })
        window.addEventListener('touchstart', cancelPendingRestore, { once: true, passive: true })
        window.addEventListener('pointerdown', cancelPendingRestore, { once: true, passive: true })
        window.addEventListener('keydown', cancelPendingRestore, { once: true })
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }

    return () => {
      saveScrollPosition(location.key, window.scrollY)
      stopRetrying()
      window.removeEventListener('wheel', cancelPendingRestore)
      window.removeEventListener('touchstart', cancelPendingRestore)
      window.removeEventListener('pointerdown', cancelPendingRestore)
      window.removeEventListener('keydown', cancelPendingRestore)
    }
  }, [location.key])

  return <div className={`shell ${isLogin ? 'login-shell' : ''} ${isHome ? 'home-shell' : ''}`}>
    <Header center={center} hidden={isLogin} />
    <Outlet />
  </div>
}
