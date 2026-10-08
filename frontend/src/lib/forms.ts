import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '../api/client'
import { useErrorText } from './hooks'

/** DRF validation errors look like {"title": ["This field is required."]}: take the first message per field. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.data || typeof error.data !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [field, value] of Object.entries(error.data as Record<string, unknown>)) {
    if (field === 'detail' || field === 'code' || field === 'non_field_errors') continue
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === 'string') result[field] = first
  }
  return result
}

/**
 * Error state for a form: messages under the fields that the API rejected,
 * plus one line on top for everything else (business rules, network errors).
 */
export function useFormErrors() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [error, setError] = useState<unknown>(null)
  const fields = fieldErrors(error)
  const hasFieldErrors = Object.keys(fields).length > 0

  return {
    setError,
    clear: () => setError(null),
    /** Message for the top of the form, or null. */
    formError: error === null ? null : hasFieldErrors ? t('common.checkFields') : errorText(error),
    /** Message for one field, or undefined. */
    field: (name: string): string | undefined => fields[name],
  }
}
