import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import './RootLayout.css'

export function RootLayout({ center = false }) {
  const location = useLocation()
  const isLogin = location.pathname === '/login'

  return <div className={`shell ${isLogin ? 'login-shell' : ''}`}>
    <Header center={center} hidden={isLogin} />
    <Outlet />
  </div>
}
