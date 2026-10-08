import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Route, Routes } from 'react-router-dom'

import { RequireAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { lazyPage } from './lib/lazyPage'
import { LoginPage } from './pages/LoginPage'

// Code splitting: each page is downloaded only when it is opened for the first time.
// The dashboard charts (Recharts) are the heaviest part, so the login page loads much faster.
const DashboardPage = lazyPage(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const DealsBoardPage = lazyPage(() => import('./pages/DealsBoardPage').then((m) => ({ default: m.DealsBoardPage })))
const DealPage = lazyPage(() => import('./pages/DealPage').then((m) => ({ default: m.DealPage })))
const ClientsPage = lazyPage(() => import('./pages/ClientsPage').then((m) => ({ default: m.ClientsPage })))
const PropertiesPage = lazyPage(() => import('./pages/PropertiesPage').then((m) => ({ default: m.PropertiesPage })))
const TasksPage = lazyPage(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })))

function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="py-24 text-center">
      <div className="text-6xl font-semibold text-brand-700">404</div>
      <p className="mt-2 text-slate-600">{t('common.notFound')}</p>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
        {t('common.toHome')}
      </Link>
    </div>
  )
}

export function App() {
  return (
    <Suspense fallback={<Spinner className="min-h-[50vh]" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="deals" element={<DealsBoardPage />} />
          <Route path="deals/:id" element={<DealPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
