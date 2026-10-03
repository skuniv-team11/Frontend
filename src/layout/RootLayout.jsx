import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import './RootLayout.css'

export function RootLayout({ center = false }) {
  return <div className="shell">
    <Header center={center} />
    <Outlet />
  </div>
}
