import { describe, expect, it } from 'vitest'

import { en } from './en'
import { ru } from './ru'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  )
}

describe('translations', () => {
  it('Russian and English have the same keys', () => {
    expect(keys(ru).sort()).toEqual(keys(en).sort())
  })

  it('has a translation for every API error code returned by the backend', () => {
    const backendCodes = [
      'invalid_credentials',
      'session_expired',
      'property_required',
      'amount_required',
      'lost_reason_required',
      'property_unavailable',
      'property_type_mismatch',
      'property_locked',
      'reopen_requires_head',
      'head_only',
      'status_managed_by_deals',
      'property_has_deals',
      'client_has_deals',
      'empty_note',
      'demo_readonly',
      'property_in_use',
      'invalid_filter',
    ]
    for (const code of backendCodes) {
      expect(en.errors).toHaveProperty(code)
      expect(ru.errors).toHaveProperty(code)
    }
  })
})
