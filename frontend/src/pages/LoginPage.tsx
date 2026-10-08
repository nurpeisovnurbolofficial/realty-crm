import { CheckCircle2, Crown, UserRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { useDemoAccounts } from '../api/hooks'
import { useAuth } from '../auth/context'
import { useErrorText } from '../lib/hooks'
import { LanguageSwitch, Logo } from '../components/Layout'
import { Button, FormError, Input, PasswordInput } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function LoginPage() {
  const { t } = useTranslation()
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const errorText = useErrorText()
  const demo = useDemoAccounts()
  useDocumentTitle(t('auth.signIn'))

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to={from} replace />

  async function signIn(name: string, pass: string, marker: string) {
    setError(null)
    setPending(marker)
    try {
      await login(name, pass)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setPending(null)
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void signIn(username, password, 'form')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left: what this product is — useful for recruiters who open the demo */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-600/30 blur-3xl" />
        <Logo light />
        <div className="relative">
          <h2 className="text-3xl leading-tight font-semibold">{t('auth.tagline')}</h2>
          <ul className="mt-8 space-y-4 text-slate-300">
            {(['feature1', 'feature2', 'feature3', 'feature4'] as const).map((key) => (
              <li key={key} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-500" />
                {t(`auth.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-slate-500">Django REST Framework · React · TypeScript · PostgreSQL</p>
      </div>

      {/* Right: the form */}
      <div className="flex flex-col p-6 sm:p-12">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <LanguageSwitch className="ml-auto" />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold text-slate-900">{t('auth.title')}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">{t('auth.subtitle')}</p>

          <FormError message={error} />
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label={t('auth.username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
            <PasswordInput
              label={t('auth.password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" className="w-full" loading={pending === 'form'}>
              {t('auth.signIn')}
            </Button>
          </form>

          {demo.data && demo.data.length > 0 && (
            <div className="mt-8 rounded-xl border border-brand-100 bg-brand-50 p-4">
              <p className="mb-3 text-sm text-brand-900">{t('auth.demoTitle')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {demo.data.map((account) => (
                  <Button
                    key={account.username}
                    variant="secondary"
                    loading={pending === account.username}
                    icon={
                      account.role === 'head' ? (
                        <Crown className="size-4 text-amber-500" />
                      ) : (
                        <UserRound className="size-4 text-brand-600" />
                      )
                    }
                    onClick={() => void signIn(account.username, account.password, account.username)}
                  >
                    {t(`roles.${account.role}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
