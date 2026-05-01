import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth.jsx'
import Layout from './components/Layout.jsx'
import { supabaseMisconfigured } from './lib/supabase.js'

import Landing        from './pages/Landing.jsx'
import Login          from './pages/Login.jsx'
import Register       from './pages/Register.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import Terms          from './pages/Terms.jsx'
import Privacy        from './pages/Privacy.jsx'
import Analyzer       from './pages/Analyzer.jsx'
import Matters        from './pages/Matters.jsx'
import Analysis       from './pages/Analysis.jsx'
import Comparison     from './pages/Comparison.jsx'
import Settings       from './pages/Settings.jsx'
import AdminConsole   from './pages/AdminConsole.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"/></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/analyze" replace />
  return children
}

export default function App() {
  if (supabaseMisconfigured) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-lg">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl font-bold">!</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Configuration Required</h1>
          <p className="text-sm text-slate-600 mb-4">
            Supabase environment variables are not set. Add <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code> and <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to Netlify, then redeploy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/"                element={<Landing />} />
        <Route path="/login"           element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"        element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/terms"           element={<Terms />} />
        <Route path="/privacy"         element={<Privacy />} />

        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          {/* Primary one-shot Analyzer */}
          <Route path="/analyze"                                       element={<Analyzer />} />

          {/* Past matters — read-only history */}
          <Route path="/matters"                                       element={<Matters />} />
          <Route path="/matters/:matterId/analysis/:analysisId"        element={<Analysis />} />
          <Route path="/matters/:matterId/compare/:comparisonGroupId"  element={<Comparison />} />

          {/* Legacy /team URLs redirect to the Team tab inside Settings */}
          <Route path="/team"                                          element={<Navigate to="/settings?tab=team" replace />} />
          <Route path="/settings"                                      element={<Settings />} />

          {/* Operator-only god-mode console (RLS + page-level guard) */}
          <Route path="/admin"                                         element={<AdminConsole />} />
        </Route>

        {/* Default authenticated landing → Analyzer */}
        <Route path="*" element={<Navigate to="/analyze" replace />} />
      </Routes>
    </AuthProvider>
  )
}
