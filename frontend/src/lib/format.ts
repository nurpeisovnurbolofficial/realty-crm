// Formatting helpers. Intl.* gives correct separators for each language: "45 000 000 ₸" vs "₸45,000,000".

const locales: Record<string, string> = { en: 'en-US', ru: 'ru-RU' }
const localeOf = (lang: string) => locales[lang] ?? 'en-US'

export function formatMoney(value: number, lang: string, compact = false): string {
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency: 'KZT',
    currencyDisplay: 'narrowSymbol', // always "₸", never "KZT"
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value)
}

export function formatDate(value: string | null, lang: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(value),
  )
}

export function formatDateTime(value: string, lang: string): string {
  return new Intl.DateTimeFormat(localeOf(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatMonth(value: string, lang: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(localeOf(lang), { month: 'short' }).format(new Date(year, month - 1, 1))
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}

/** Value for <input type="datetime-local"> in the user's local time. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
