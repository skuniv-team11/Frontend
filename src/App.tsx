import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ApplyPage } from './pages/ApplyPage'
import { CenterPage } from './pages/CenterPage'
import { CounselPage } from './pages/CounselPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { JobsPage } from './pages/JobsPage'
import { LoginPage } from './pages/LoginPage'
import { MePage } from './pages/MePage'
import { PlanPage } from './pages/PlanPage'
import { ProfilePage } from './pages/ProfilePage'
import { StartPage } from './pages/StartPage'

export default function App(){return <BrowserRouter><Routes><Route path="/" element={<StartPage/>}/><Route path="/login" element={<LoginPage/>}/><Route path="/profile" element={<ProfilePage/>}/><Route path="/jobs" element={<JobsPage/>}/><Route path="/jobs/:id" element={<JobDetailPage/>}/><Route path="/plan" element={<PlanPage/>}/><Route path="/plan/apply" element={<ApplyPage/>}/><Route path="/plan/counsel" element={<CounselPage/>}/><Route path="/me" element={<MePage/>}/><Route path="/center" element={<CenterPage/>}/><Route path="*" element={<StartPage/>}/></Routes></BrowserRouter>}
