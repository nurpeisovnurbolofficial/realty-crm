import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LOST_REASONS, type LostReason } from '../api/types'
import { Button, Modal, Select, Textarea } from './ui'

interface Props {
  dealTitle: string
  onCancel: () => void
  onConfirm: (reason: LostReason, comment: string) => void
}

/** Asks why a deal was lost: a reason from the list, plus a comment (required for "Other"). */
export function LostDealModal({ dealTitle, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState<LostReason | ''>('')
  const [comment, setComment] = useState('')
  const needsComment = reason === 'other'
  const canSubmit = reason !== '' && (!needsComment || comment.trim() !== '')

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (reason && canSubmit) onConfirm(reason, comment.trim())
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={t('deals.lostTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="lost-form" variant="danger" disabled={!canSubmit}>
            {t('stages.lost')}
          </Button>
        </>
      }
    >
      <form id="lost-form" onSubmit={onSubmit} className="grid gap-4">
        <p className="text-sm text-slate-600">{dealTitle}</p>
        <Select
          label={t('deals.lostReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value as LostReason)}
          placeholder={t('deals.chooseReason')}
          options={LOST_REASONS.map((code) => ({ value: code, label: t(`lostReasons.${code}`) }))}
          required
        />
        <Textarea
          label={needsComment ? t('deals.lostCommentRequired') : t('deals.lostComment')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('deals.lostPlaceholder')}
          maxLength={200}
          rows={2}
        />
      </form>
    </Modal>
  )
}
