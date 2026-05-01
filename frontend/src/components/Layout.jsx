import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import {
  LayoutDashboard, FileText, FolderOpen, Settings, LogOut,
  Menu, X, Moon, Sun, Sparkles, History,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/analyze',   icon: Sparkles,        label: 'New analysis', primary: true },
  { to: '/matters',   icon: History,         label: 'Past matters' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const { dark, toggle: toggleDark } = useTheme()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  const NavItems = () => (
    <>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to} to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/8'
            }`
          }
          onClick={() => setSidebarOpen(false)}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {label}
        </NavLink>
      ))}
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            isActive
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/8'
          }`
        }
        onClick={() => setSidebarOpen(false)}
      >
        <Settings className="h-4 w-4 flex-shrink-0" />
        Settings
      </NavLink>
    </>
  )

  const SidebarContents = () => (
    <>
      <div className="px-4 py-5 border-b border-white/8">
        <Link to="/analyze" className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="LexClause" className="w-10 h-10 rounded-xl ring-1 ring-white/10" />
          <div>
            <div className="text-white font-bold text-lg leading-none font-serif-brand">LexClause</div>
            <div className="text-slate-400 text-[11px] mt-1 tracking-wide">Coverage analysis</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <NavItems />
      </nav>

      <div className="px-3 py-3 border-t border-white/8 space-y-1">
        {profile && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex-1 min-w-0 text-xs text-slate-400 truncate">
              {profile.first_name || ''} {profile.last_name || ''}
              <div className="text-slate-500 truncate">{profile.organization?.name || ''}</div>
            </div>
            <button
              onClick={toggleDark}
              className="flex-shrink-0 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/8 rounded-lg"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-64 bg-slate-900 border-r border-white/5">
        <SidebarContents />
      </aside>

      {/* Sidebar — mobile drawer */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-slate-900 border-r border-white/5">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContents />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
