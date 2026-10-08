import '../i18n'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { changeLanguage } from '../i18n'
import { LoginPage } from './LoginPage'

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

const demoAccounts = [
  { username: 'aliya', role: 'head', password: 'demo' },
  { username: 'daniyar', role: 'manager', password: 'demo' },
]

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/auth/me/') return respond(401)
    if (url === '/api/auth/refresh/') return respond(401)
    if (url === '/api/auth/demo-accounts/') return respond(200, demoAccounts)
    if (url === '/api/auth/login/') {
      const { username } = JSON.parse(String(init?.body))
      return username === 'aliya'
        ? respond(200, { id: 1, username, display_name: 'Aliya', role: 'head', is_head: true })
        : respond(400, { code: 'invalid_credentials', detail: 'Wrong' })
    }
    return respond(404)
  })

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'csrftoken=t'
    changeLanguage('en')
  })
  afterEach(() => {
    fetchMock.mockClear()
    vi.unstubAllGlobals()
  })

  it('shows one-click demo logins and signs in with them', async () => {
    renderLogin()
    const headButton = await screen.findByRole('button', { name: /head of sales/i })
    expect(screen.getByRole('button', { name: /manager/i })).toBeInTheDocument()

    await userEvent.click(headButton)
    const loginCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login/')
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({ username: 'aliya', password: 'demo' })
  })

  it('shows a translated error for a wrong password', async () => {
    changeLanguage('ru')
    renderLogin()
    await userEvent.type(screen.getByLabelText('Логин'), 'someone')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(await screen.findByText('Неверный логин или пароль.')).toBeInTheDocument()
  })
})
