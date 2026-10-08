import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import { formatMoney } from './format'

export function useMoney() {
  const { i18n } = useTranslation()
  return (value: number, compact = false) => formatMoney(value, i18n.language, compact)
}

/** Turns any error into a translated message, using the API error `code` when there is one. */
export function useErrorText() {
  const { t } = useTranslation()
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      return t(`errors.${error.code}`, { defaultValue: error.message || t('common.error') })
    }
    return t('common.error')
  }
}
