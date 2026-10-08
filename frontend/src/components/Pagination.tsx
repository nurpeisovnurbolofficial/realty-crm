import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from './ui'

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const shown = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-sm text-slate-500">
      <span>{t('common.shown', { shown, total })}</span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft className="size-4" />}
        >
          {t('common.prev')}
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          {t('common.next')} <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
