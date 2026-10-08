import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, buildUrl, errorMessage, setSessionExpiredHandler } from './client'

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('buildUrl', () => {
  it('skips empty values', () => {
    expect(buildUrl('/api/deals/', { search: '', owner: 3, deal_type: undefined, page: 2 })).toBe(
      '/api/deals/?owner=3&page=2',
    )
  })
})

describe('errorMessage', () => {
  it('reads DRF field errors and detail', () => {
    expect(errorMessage({ detail: 'Nope' }, 'x')).toBe('Nope')
    expect(errorMessage({ title: ['This field is required.'] }, 'x')).toBe('title: This field is required.')
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})

describe('api()', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'csrftoken=test-token'
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('sends the CSRF token on unsafe requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 1 }))
    await api('/api/clients/', { method: 'POST', body: { name: 'A' } })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['X-CSRFToken']).toBe('test-token')
    expect(init.credentials).toBe('same-origin')
  })

  it('refreshes the session once on 401 and repeats the request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { detail: 'expired' })) // original request
      .mockResolvedValueOnce(jsonResponse(204)) // POST /api/auth/refresh/
      .mockResolvedValueOnce(jsonResponse(200, { ok: true })) // repeated request

    await expect(api('/api/deals/')).resolves.toEqual({ ok: true })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/deals/', '/api/auth/refresh/', '/api/deals/'])
  })

  it('calls the session-expired handler when refresh fails', async () => {
    const expired = vi.fn()
    setSessionExpiredHandler(expired)
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(401, { code: 'session_expired' }))
    fetchMock.mockResolvedValueOnce(jsonResponse(401))

    await expect(api('/api/deals/')).rejects.toBeInstanceOf(ApiError)
    expect(expired).toHaveBeenCalledOnce()
  })

  it('exposes the API error code for translation', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { code: 'property_unavailable', detail: 'Taken' }))
    const error = await api('/api/deals/1/move/', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('property_unavailable')
  })
})
