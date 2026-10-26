import { RouterProvider } from 'react-router-dom'
import { router } from './router'
// 프로토타입 순서대로 페이지 CSS(fe) 뒤에 fx → v2를 얹는다
import './styles/fx.css'
import './styles/v2.css'
import './styles/app-v2.css'

export default function App() {
  return <RouterProvider router={router} />
}
