import { type ReactNode, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmContext, type ConfirmOptions } from '../lib/confirm'
import { Button, Modal } from './ui'

/** Renders one confirmation dialog for the whole app; useConfirm() opens it and waits for the answer. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(value: boolean) => void>(() => {})

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function answer(value: boolean) {
    resolver.current(value)
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        title={options?.title ?? ''}
        onClose={() => answer(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => answer(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => answer(true)}>
              {options?.confirmLabel ?? t('common.delete')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">{options?.text ?? t('common.confirmDelete')}</p>
      </Modal>
    </ConfirmContext.Provider>
  )
}
