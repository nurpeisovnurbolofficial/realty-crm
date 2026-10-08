import '../i18n'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { changeLanguage } from '../i18n'
import { useConfirm } from '../lib/confirm'
import { ConfirmProvider } from './ConfirmProvider'

function DeleteButton({ onResult }: { onResult: (ok: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button type="button" onClick={async () => onResult(await confirm({ title: 'Delete deal?' }))}>
      open
    </button>
  )
}

describe('ConfirmProvider', () => {
  it('resolves true on confirm and false on cancel, and returns focus to the trigger', async () => {
    changeLanguage('en')
    const results: boolean[] = []
    render(
      <ConfirmProvider>
        <DeleteButton onResult={(ok) => results.push(ok)} />
      </ConfirmProvider>,
    )
    const trigger = screen.getByRole('button', { name: 'open' })

    await userEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Delete deal?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(results).toEqual([true, false])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes with Escape (counts as cancel)', async () => {
    const results: boolean[] = []
    render(
      <ConfirmProvider>
        <DeleteButton onResult={(ok) => results.push(ok)} />
      </ConfirmProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'open' }))
    await userEvent.keyboard('{Escape}')
    expect(results).toEqual([false])
  })
})
