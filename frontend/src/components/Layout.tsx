import clsx from 'clsx'
import { BookOpen, Building2, CheckSquare, KanbanSquare, LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/context'
import { changeLanguage, LANGUAGES, type Language } from '../i18n'
import { Avatar } from './ui'

const nav = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/deals', key: 'deals', icon: KanbanSquare },
  { to: '/clients', key: 'clients', icon: Users },
  { to: '/properties', key: 'properties', icon: Building2 },
  { to: '/tasks', key: 'tasks', icon: CheckSquare },
] as const

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className={clsx('text-lg font-semibold tracking-tight', light ? 'text-white' : 'text-slate-900')}>
        Realty<span className="text-brand-500">CRM</span>
      </span>
    </div>
  )
}

export function LanguageSwitch({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  return (
    <div
      className={clsx('inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold', className)}
    >
      {LANGUAGES.map((lang: Language) => (
        <button
          key={lang}
          type="button"
          onClick={() => changeLanguage(lang)}
          className={clsx(
            'rounded-md px-2 py-1 uppercase transition-colors',
            i18n.language === lang ? 'bg-brand-700 text-white' : 'text-slate-500 hover:text-slate-800',
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <item.icon className="size-5" />
          {t(`nav.${item.key}`)}
        </NavLink>
      ))}
      <a
        href="/api/docs/"
        target="_blank"
        rel="noreferrer"
        className="mt-auto mb-4 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white"
      >
        <BookOpen className="size-5" />
        {t('nav.apiDocs')}
      </a>
    </nav>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-slate-900 py-5 lg:flex">
        <div className="mb-8 px-6">
          <Logo light />
        </div>
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900 py-5">
            <div className="mb-8 flex items-center justify-between px-6">
              <Logo light />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-slate-400"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button
          type="button"
          className="text-slate-600 lg:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-6" />
        </button>
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="ml-auto flex items-center gap-3">
          {user?.demo_mode && (
            <span
              title={t('common.demoHint')}
              className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 sm:inline"
            >
              {t('common.demo')}
            </span>
          )}
          <LanguageSwitch />
          {user && (
            <div className="flex items-center gap-2">
              <Avatar name={user.display_name} className="size-8" />
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-medium text-slate-800">{user.display_name}</div>
                <div className="text-xs text-slate-500">{t(`roles.${user.role}`)}</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title={t('nav.logout')}
            aria-label={t('nav.logout')}
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
