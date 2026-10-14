import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AuthProvider, RequireAdmin } from './lib/auth'
import { supabaseConfigured } from './lib/supabase'
import { FullScreenSpinner } from './components/Spinner'
import { GameBackground } from './components/GameBackground'
import { Logo } from './components/Logo'
import { JoinPage } from './pages/play/JoinPage'
import { PlayPage } from './pages/play/PlayPage'

// Admin a host sa načítajú až keď treba – mobily hráčov sťahujú len malú časť aplikácie.
const LoginPage = lazy(() => import('./pages/admin/LoginPage'))
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'))
const QuizEditorPage = lazy(() => import('./pages/admin/QuizEditorPage'))
const HostPage = lazy(() => import('./pages/host/HostPage'))

export function App() {
  if (!supabaseConfigured) return <MissingConfig />
  return (
    <AuthProvider>
      <Suspense fallback={<FullScreenSpinner />}>
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
          <Route path="/admin/quiz/:quizId" element={<RequireAdmin><QuizEditorPage /></RequireAdmin>} />
          <Route path="/host/:gameId" element={<RequireAdmin><HostPage /></RequireAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

function MissingConfig() {
  return (
    <GameBackground className="flex items-center justify-center p-6">
      <div className="game-card max-w-lg space-y-4 p-8">
        <Logo light={false} />
        <h1 className="text-xl font-extrabold">Chýba pripojenie k databáze</h1>
        <p className="text-gray-600">
          Nastav premenné prostredia <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_URL</code> a{' '}
          <code className="rounded bg-gray-100 px-1">VITE_SUPABASE_ANON_KEY</code> (súbor <code>.env</code> lokálne,
          alebo Environment Variables vo Verceli) a aplikáciu znova zostav. Postup je v README.md.
        </p>
      </div>
    </GameBackground>
  )
}
