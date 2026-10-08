import { describe, expect, it } from 'vitest'

import { formatMoney, initials, toLocalInput } from './format'

// Intl uses non-breaking spaces as thousand separators; normalize them for readable assertions.
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('formatMoney', () => {
  it('formats tenge for each language', () => {
    expect(plain(formatMoney(45_000_000, 'ru'))).toBe('45 000 000 ₸')
    expect(formatMoney(45_000_000, 'en')).toContain('45,000,000')
  })

  it('has a compact form for dashboards', () => {
    expect(formatMoney(45_000_000, 'en', true)).toContain('45M')
  })
})

describe('initials', () => {
  it('takes the first letters of up to two words', () => {
    expect(initials('Aliya Sadykova')).toBe('AS')
    expect(initials('daniyar')).toBe('D')
    expect(initials('  Madina   Akhmetova  Extra ')).toBe('MA')
  })
})

describe('toLocalInput', () => {
  it('produces a value for <input type="datetime-local">', () => {
    expect(toLocalInput(new Date(2026, 9, 9, 7, 5))).toBe('2026-10-09T07:05')
  })
})
