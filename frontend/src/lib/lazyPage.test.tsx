import { render, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { lazyPage } from './lazyPage'

describe('lazyPage', () => {
  const reload = vi.fn()

  afterEach(() => {
    sessionStorage.clear()
    reload.mockReset()
    vi.unstubAllGlobals()
  })

  it('reloads the page once when a page file from an old build is missing', async () => {
    vi.stubGlobal('location', { ...window.location, reload })
    const Page = lazyPage(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))
    render(
      <Suspense fallback={<span>loading</span>}>
        <Page />
      </Suspense>,
    )
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(screen.getByText('loading')).toBeInTheDocument()
  })

  it('renders the page normally when the file loads', async () => {
    const Page = lazyPage(() => Promise.resolve({ default: () => <span>deals page</span> }))
    render(
      <Suspense fallback={<span>loading</span>}>
        <Page />
      </Suspense>,
    )
    expect(await screen.findByText('deals page')).toBeInTheDocument()
  })
})
