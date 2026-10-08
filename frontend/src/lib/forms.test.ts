import { describe, expect, it } from 'vitest'

import { ApiError } from '../api/client'
import { fieldErrors } from './forms'

describe('fieldErrors', () => {
  it('takes the first message of every field from a DRF validation error', () => {
    const error = new ApiError(400, 'http_400', 'Bad', {
      title: ['This field is required.', 'Another'],
      phone: ['Enter a valid phone.'],
      non_field_errors: ['Something general'],
    })
    expect(fieldErrors(error)).toEqual({ title: 'This field is required.', phone: 'Enter a valid phone.' })
  })

  it('ignores business errors that have a code instead of fields', () => {
    const error = new ApiError(400, 'property_unavailable', 'Taken', { code: 'property_unavailable', detail: 'Taken' })
    expect(fieldErrors(error)).toEqual({})
  })

  it('ignores anything that is not an API error', () => {
    expect(fieldErrors(new Error('network'))).toEqual({})
  })
})
