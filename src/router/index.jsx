import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '../layout/RootLayout'
import { CenterPage } from '../pages/center/CenterPage'
import { StartPage } from '../pages/home/StartPage'
import { JobDetailPage } from '../pages/jobs/JobDetailPage'
import { JobsPage } from '../pages/jobs/JobsPage'
import { LoginPage } from '../pages/login/LoginPage'
import { MePage } from '../pages/myinfo/MePage'
import { ApplyPage } from '../pages/plan/ApplyPage'
import { CounselPage } from '../pages/plan/CounselPage'
import { PlanPage } from '../pages/plan/PlanPage'
import { ProfilePage } from '../pages/profile/ProfilePage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <StartPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/jobs', element: <JobsPage /> },
      { path: '/jobs/:id', element: <JobDetailPage /> },
      { path: '/plan', element: <PlanPage /> },
      { path: '/plan/apply', element: <ApplyPage /> },
      { path: '/plan/counsel', element: <CounselPage /> },
      { path: '/me', element: <MePage /> },
      { path: '*', element: <StartPage /> },
    ],
  },
  {
    element: <RootLayout center />,
    children: [{ path: '/center', element: <CenterPage /> }],
  },
])
