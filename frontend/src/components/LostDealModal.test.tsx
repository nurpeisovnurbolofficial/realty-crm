import '../i18n'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { changeLanguage } from '../i18n'
import { LostDealModal } from './LostDealModal'

describe('LostDealModal', () => {
  it('needs a reason from the list, and a comment only for "Other"', async () => {
    changeLanguage('en')
    const onConfirm = vi.fn()
    render(<LostDealModal dealTitle="Aigerim — flat" onCancel={() => {}} onConfirm={onConfirm} />)
    const submit = screen.getByRole('button', { name: 'Lost' })
    const reason = screen.getByLabelText('Reason')

    expect(submit).toBeDisabled() // nothing chosen yet

    await userEvent.selectOptions(reason, 'other')
    expect(submit).toBeDisabled() // "Other" needs an explanation
    await userEvent.type(screen.getByRole('textbox'), 'Moved to Almaty')
    expect(submit).toBeEnabled()

    await userEvent.selectOptions(reason, 'mortgage')
    await userEvent.click(submit)
    expect(onConfirm).toHaveBeenCalledWith('mortgage', 'Moved to Almaty')
  })

  it('shows the reasons in Russian', () => {
    changeLanguage('ru')
    render(<LostDealModal dealTitle="x" onCancel={() => {}} onConfirm={() => {}} />)
    expect(screen.getByRole('option', { name: 'Не одобрили ипотеку' })).toBeInTheDocument()
    changeLanguage('en')
  })
})
