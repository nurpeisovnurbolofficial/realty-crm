/**
 * The Kanban board: one column per pipeline stage, cards are deals.
 *
 * Drag and drop is done with dnd-kit: each card is "draggable", each column is "droppable".
 * When a card is dropped on another column we call POST /api/deals/:id/move/ with an optimistic
 * update (see useMoveDeal): the card moves instantly and returns if the server rejects the move.
 */
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { CalendarDays, CheckSquare, Home, Lock, Plus, Search } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useBoard, useMoveDeal, useUsers } from '../api/hooks'
import { type DealListItem, type Stage, STAGES } from '../api/types'
import { useAuth } from '../auth/context'
import { DealForm } from '../components/DealForm'
import { useErrorText, useMoney } from '../lib/hooks'
import { stageAccent } from '../lib/stages'
import { useToast } from '../lib/toast'
import { Avatar, Button, ErrorState, Input, Modal, PageHeader, Segmented, Select, Spinner } from '../components/ui'
import { formatDate } from '../lib/format'
import { useDebounced } from '../lib/useDebounced'
import { useDocumentTitle } from '../lib/useDocumentTitle'

function DealCard({ deal, overlay = false }: { deal: DealListItem; overlay?: boolean }) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const money = useMoney()
  const navigate = useNavigate()
  // Only the head of sales may move a closed deal, so for managers such cards are not draggable.
  const locked = (deal.stage === 'won' || deal.stage === 'lost') && !user?.is_head
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled: locked,
  })

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform) }}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={() => navigate(`/deals/${deal.id}`)}
      title={locked ? t('deals.locked') : undefined}
      className={clsx(
        locked ? 'cursor-pointer' : 'cursor-grab',
        'rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-shadow select-none hover:border-brand-500 hover:shadow-md',
        isDragging && !overlay && 'opacity-30',
        overlay && 'rotate-2 cursor-grabbing shadow-xl',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm leading-snug font-medium text-slate-900">
          {locked && <Lock className="mr-1 inline size-3 text-slate-400" />}
          {deal.title}
        </div>
        <Avatar name={deal.owner.display_name} className="size-6 text-[10px]" />
      </div>
      <div className="mt-1 text-xs text-slate-500">{deal.client.name}</div>
      {deal.property && (
        <div className="mt-2 flex items-center gap-1 truncate text-xs text-slate-500">
          <Home className="size-3 shrink-0" />
          <span className="truncate">{deal.property.title}</span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-900">{deal.amount ? money(deal.amount, true) : '—'}</span>
        <span className="flex items-center gap-2 text-slate-400">
          {deal.open_tasks > 0 && (
            <span className="flex items-center gap-0.5" title={t('deals.openTasks', { count: deal.open_tasks })}>
              <CheckSquare className="size-3" />
              {deal.open_tasks}
            </span>
          )}
          {deal.expected_close_date && (
            <span className="flex items-center gap-0.5">
              <CalendarDays className="size-3" />
              {formatDate(deal.expected_close_date, i18n.language).replace(/,? \d{4}( г\.)?$/, '')}
            </span>
          )}
          <span className="rounded bg-slate-100 px-1 text-slate-500">{t(`dealTypes.${deal.deal_type}`)}</span>
        </span>
      </div>
    </div>
  )
}

function Column({ stage, deals }: { stage: Stage; deals: DealListItem[] }) {
  const { t } = useTranslation()
  const money = useMoney()
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0)

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className={clsx('size-2 rounded-full', stageAccent[stage])} />
          <span className="text-sm font-semibold text-slate-800">{t(`stages.${stage}`)}</span>
          <span className="rounded-full bg-slate-200 px-1.5 text-xs font-medium text-slate-600">{deals.length}</span>
        </div>
        <div className="mt-0.5 pl-4 text-xs text-slate-500">{money(total, true)}</div>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          'flex min-h-40 flex-1 flex-col gap-2 rounded-xl p-2 transition-colors',
          isOver ? 'bg-brand-50 ring-2 ring-brand-500/40' : 'bg-slate-100/80',
        )}
      >
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
            {t('deals.dropHere')}
          </div>
        )}
      </div>
    </div>
  )
}

export function DealsBoardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const toast = useToast()
  const errorText = useErrorText()
  const users = useUsers()
  useDocumentTitle(t('nav.deals'))

  const [search, setSearch] = useState('')
  const [dealType, setDealType] = useState<'' | 'sale' | 'rent'>('')
  const [owner, setOwner] = useState('')
  const debouncedSearch = useDebounced(search)
  const filters = useMemo(
    () => ({ search: debouncedSearch, deal_type: dealType, owner }),
    [debouncedSearch, dealType, owner],
  )
  const board = useBoard(filters)
  const move = useMoveDeal(filters)

  const [active, setActive] = useState<DealListItem | null>(null)
  const [lostDeal, setLostDeal] = useState<DealListItem | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [creating, setCreating] = useState(false)

  // A small movement threshold, so a simple click still opens the deal instead of starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function doMove(deal: DealListItem, stage: Stage, reason?: string) {
    move.mutate(
      { id: deal.id, stage, lostReason: reason },
      {
        onSuccess: () => toast('success', t('deals.moved', { stage: t(`stages.${stage}`) })),
        onError: (error) => toast('error', errorText(error)),
      },
    )
  }

  function onDragStart(event: DragStartEvent) {
    setActive((event.active.data.current as { deal: DealListItem }).deal)
  }

  function onDragEnd(event: DragEndEvent) {
    setActive(null)
    const deal = (event.active.data.current as { deal: DealListItem }).deal
    const stage = event.over?.id as Stage | undefined
    if (!stage || stage === deal.stage) return
    if (stage === 'lost') {
      setLostReason('')
      setLostDeal(deal) // ask for the reason first
      return
    }
    doMove(deal, stage)
  }

  function confirmLost(event: FormEvent) {
    event.preventDefault()
    if (lostDeal) doMove(lostDeal, 'lost', lostReason)
    setLostDeal(null)
  }

  return (
    <>
      <PageHeader
        title={t('deals.title')}
        subtitle={t('deals.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t('deals.new')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <Segmented
          value={dealType}
          onChange={setDealType}
          options={[
            { value: '', label: t('common.all') },
            { value: 'sale', label: t('dealTypes.sale') },
            { value: 'rent', label: t('dealTypes.rent') },
          ]}
        />
        {user?.is_head && (
          <Select
            aria-label={t('deals.owner')}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder={t('dashboard.allManagers')}
            options={(users.data ?? [])
              .filter((u) => u.role === 'manager')
              .map((u) => ({ value: u.id, label: u.display_name }))}
            className="w-48"
          />
        )}
      </div>

      {board.isLoading && <Spinner />}
      {board.isError && <ErrorState onRetry={() => void board.refetch()} />}
      {board.data && (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActive(null)}
        >
          <div className="scroll-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
            {STAGES.map((stage) => (
              <Column key={stage} stage={stage} deals={board.data[stage]} />
            ))}
          </div>
          <DragOverlay>{active && <DealCard deal={active} overlay />}</DragOverlay>
        </DndContext>
      )}

      <Modal
        open={lostDeal !== null}
        onClose={() => setLostDeal(null)}
        title={t('deals.lostTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostDeal(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="lost-form" variant="danger" disabled={!lostReason.trim()}>
              {t('stages.lost')}
            </Button>
          </>
        }
      >
        <form id="lost-form" onSubmit={confirmLost}>
          <p className="mb-3 text-sm text-slate-600">{lostDeal?.title}</p>
          <Input
            autoFocus
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder={t('deals.lostPlaceholder')}
            maxLength={200}
          />
        </form>
      </Modal>

      {creating && <DealForm onClose={() => setCreating(false)} />}
    </>
  )
}
