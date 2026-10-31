import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '../layout/RootLayout'
import { ApplyPage } from '../pages/apply/ApplyPage'
import { ApprovalPage } from '../pages/apply/ApprovalPage'
import { CareerPage } from '../pages/career/CareerPage'
import { CenterBoardPage } from '../pages/center/CenterBoardPage'
import { CenterClosePage } from '../pages/center/CenterClosePage'
import { CenterInboxPage } from '../pages/center/CenterInboxPage'
import { CenterMatchPage } from '../pages/center/CenterMatchPage'
import { ExplorePage } from '../pages/explore/ExplorePage'
import { ExploreResultPage } from '../pages/explore/ExploreResultPage'
import { HomePage } from '../pages/home/HomePage'
import { MyInternshipPage } from '../pages/internship/MyInternshipPage'
import { JobDetailPage } from '../pages/jobs/JobDetailPage'
import { JobsPage } from '../pages/jobs/JobsPage'
import { LoginPage } from '../pages/login/LoginPage'
import { MePage } from '../pages/myinfo/MePage'

// 로컬 v2 화면 — 학생(상단: 홈 · 직무 탐색 · 직무 찾기 · 내 현장실습), 센터(현황판 · 접수함 · 매칭·선발 · 마무리), 승인(공개)
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/me', element: <MePage /> },
      { path: '/profile', element: <Navigate to="/me" replace state={{ editProfile: true }} /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/explore/result', element: <ExploreResultPage /> },
      { path: '/jobs', element: <JobsPage /> },
      { path: '/jobs/:id', element: <JobDetailPage /> },
      { path: '/internship', element: <MyInternshipPage /> },
      { path: '/plan', element: <Navigate to="/internship" replace /> },
      { path: '/apply', element: <ApplyPage /> },
      { path: '/career', element: <CareerPage /> },
      { path: '*', element: <HomePage /> },
    ],
  },
  {
    element: <RootLayout center />,
    children: [
      { path: '/center', element: <CenterBoardPage /> },
      { path: '/center/inbox', element: <CenterInboxPage /> },
      { path: '/center/inbox/:id', element: <CenterInboxPage /> },
      { path: '/center/match', element: <CenterMatchPage /> },
      { path: '/center/close', element: <CenterClosePage /> },
    ],
  },
  { path: '/approvals/:token', element: <ApprovalPage /> },
])
