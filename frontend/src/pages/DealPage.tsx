import clsx from 'clsx'
import { ArrowLeft, Building2, Pencil, Phone, Trash2, UserRound } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useActivities, useAddNote, useDeal, useDealAction, useDeleteDeal, useTasks, useUsers } from '../api/hooks'
import { type Activity, type Stage, STAGES } from '../api/types'
import { useAuth } from '../auth/context'
import { DealForm } from '../components/DealForm'
import { PropertyKindIcon, StageBadge } from '../components/domain'
import { useErrorText, useMoney } from '../lib/hooks'
import { stageAccent } from '../lib/stages'
import { AddTaskForm, TaskRow } from '../components/TaskList'
import { useToast } from '../lib/toast'
import { Avatar, Button, Card, EmptyState, ErrorState, Input, Modal, Select, Spinner, Textarea } from '../components/ui'
import { formatDate, formatDateTime } from '../lib/format'

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{children}</span>
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  const { t, i18n } = useTranslation()
  const translateStage = (value?: string) => (value ? t(`stages.${value}`, { defaultValue: value }) : '')
  let text: string
  if (activity.kind === 'stage')
    text = t('activity.stage', { from: translateStage(activity.data.from), to: translateStage(activity.data.to) })
  else if (activity.kind === 'owner') text = t('activity.owner', { from: activity.data.from, to: activity.data.to })
  else text = t(`activity.${activity.kind}`)

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <Avatar name={activity.author?.display_name ?? '?'} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">{activity.author?.display_name ?? '—'}</span> {text}
        </div>
        {activity.text && (
          <div
            className={clsx(
              'mt-1 rounded-lg px-3 py-2 text-sm',
              activity.kind === 'note' ? 'bg-amber-50 text-slate-800' : 'bg-slate-50 text-slate-600',
            )}
          >
            {activity.text}
          </div>
        )}
        <div className="mt-1 text-xs text-slate-400">{formatDateTime(activity.created_at, i18n.language)}</div>
      </div>
    </li>
  )
}

export function DealPage() {
  const { id } = useParams()
  const dealId = Number(id)
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const money = useMoney()
  const toast = useToast()
  const errorText = useErrorText()

  const deal = useDeal(dealId)
  const activities = useActivities(dealId)
  const tasks = useTasks({ deal: dealId, page_size: 50 })
  const users = useUsers()
  const action = useDealAction()
  const remove = useDeleteDeal()
  const addNote = useAddNote(dealId)

  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const [lostOpen, setLostOpen] = useState(false)
  const [lostReason, setLostReason] = useState('')

  if (deal.isLoading) return <Spinner />
  if (deal.error instanceof ApiError && deal.error.status === 404) {
    return (
      <div className="py-24 text-center">
        <p className="text-slate-600">{t('errors.http_404')}</p>
        <Link to="/deals" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          {t('deals.title')}
        </Link>
      </div>
    )
  }
  if (deal.isError || !deal.data) return <ErrorState onRetry={() => void deal.refetch()} />
  const d = deal.data
  const closedForMe = (d.stage === 'won' || d.stage === 'lost') && !user?.is_head

  function moveTo(stage: Stage, reason = '') {
    action.mutate(
      { id: dealId, action: 'move', body: { stage, lost_reason: reason } },
      {
        onSuccess: () => toast('success', t('deals.moved', { stage: t(`stages.${stage}`) })),
        onError: (error) => toast('error', errorText(error)),
      },
    )
  }

  function onStageClick(stage: Stage) {
    if (stage === d.stage) return
    if (stage === 'lost') {
      setLostReason('')
      setLostOpen(true)
    } else moveTo(stage)
  }

  async function onAddNote(event: FormEvent) {
    event.preventDefault()
    if (!note.trim()) return
    try {
      await addNote.mutateAsync(note)
      setNote('')
    } catch (error) {
      toast('error', errorText(error))
    }
  }

  async function onDelete() {
    if (!window.confirm(t('deals.deleteConfirm'))) return
    try {
      await remove.mutateAsync(dealId)
      toast('success', t('common.deleted'))
      navigate('/deals')
    } catch (error) {
      toast('error', errorText(error))
    }
  }

  return (
    <>
      <Link to="/deals" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t('deals.title')}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{d.title}</h1>
            <StageBadge stage={d.stage} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {t(`dealTypes.${d.deal_type}`)} · {t('deals.created')} {formatDate(d.created_at, i18n.language)}
          </p>
        </div>
        <div className="flex gap-2">
          {!closedForMe && (
            <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
              {t('common.edit')}
            </Button>
          )}
          {user?.is_head && !user.demo_mode && (
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => void onDelete()}
              loading={remove.isPending}
            >
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline stepper: click a stage to move the deal */}
      <div className="scroll-thin mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {STAGES.map((stage) => {
          const current = stage === d.stage
          return (
            <button
              key={stage}
              type="button"
              disabled={action.isPending || closedForMe}
              onClick={() => onStageClick(stage)}
              className={clsx(
                'flex min-w-28 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                current ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                'disabled:cursor-not-allowed',
              )}
            >
              <span className={clsx('size-2 rounded-full', stageAccent[stage])} />
              {t(`stages.${stage}`)}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Section title={t('deals.amount').replace(', ₸', '')}>
            <div className="text-3xl font-semibold tracking-tight text-slate-900">{money(d.amount)}</div>
            <div className="mt-1 text-sm text-slate-500">
              {t('deals.commission')}: <span className="font-medium text-brand-700">{money(d.commission)}</span> (
              {Number(d.commission_percent)}%)
            </div>
            <div className="mt-3 divide-y divide-slate-100">
              <Row label={t('deals.expectedClose')}>{formatDate(d.expected_close_date, i18n.language)}</Row>
              {d.closed_at && <Row label={t('deals.closedAt')}>{formatDate(d.closed_at, i18n.language)}</Row>}
              {d.lost_reason && <Row label={t('deals.lostReason')}>{d.lost_reason}</Row>}
              <Row label={t('deals.owner')}>
                <span className="inline-flex items-center gap-2">
                  <Avatar name={d.owner_info.display_name} className="size-6 text-[10px]" />
                  {d.owner_info.display_name}
                </span>
              </Row>
            </div>
            {user?.is_head && (
              <Select
                label={t('deals.reassign')}
                value={String(d.owner)}
                onChange={(e) =>
                  action.mutate(
                    { id: dealId, action: 'reassign', body: { owner: Number(e.target.value) } },
                    {
                      onError: (error) => toast('error', errorText(error)),
                      onSuccess: () => toast('success', t('common.saved')),
                    },
                  )
                }
                options={(users.data ?? []).map((u) => ({
                  value: u.id,
                  label: `${u.display_name} · ${t(`roles.${u.role}`)}`,
                }))}
                className="mt-3"
              />
            )}
          </Section>

          <Section title={t('deals.client')}>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <UserRound className="size-5" />
              </span>
              <div>
                <div className="font-medium text-slate-900">{d.client_info.name}</div>
                <a
                  href={`tel:${d.client_info.phone}`}
                  className="flex items-center gap-1 text-sm text-brand-700 hover:underline"
                >
                  <Phone className="size-3" /> {d.client_info.phone}
                </a>
              </div>
            </div>
          </Section>

          <Section title={t('deals.property')}>
            {d.property_info ? (
              <Link
                to={`/properties?open=${d.property_info.id}`}
                className="flex items-center gap-3 rounded-lg hover:bg-slate-50"
              >
                <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <PropertyKindIcon kind={d.property_info.kind} className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{d.property_info.title}</div>
                  <div className="text-sm text-slate-500">
                    {t(`districts.${d.property_info.district}`)} · {money(d.property_info.price, true)} ·{' '}
                    {t(`propertyStatuses.${d.property_info.status}`)}
                  </div>
                </div>
              </Link>
            ) : (
              <EmptyState text={t('deals.noProperty')} icon={<Building2 className="size-6 text-slate-300" />} />
            )}
          </Section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Section title={t('deals.tasks')}>
            <AddTaskForm dealId={dealId} />
            {tasks.data && tasks.data.results.length > 0 ? (
              <ul className="mt-2 divide-y divide-slate-100">
                {tasks.data.results.map((task) => (
                  <TaskRow key={task.id} task={task} showDeal={false} showAssignee={user?.is_head} />
                ))}
              </ul>
            ) : (
              !tasks.isLoading && <EmptyState text={t('tasks.empty')} />
            )}
          </Section>

          <Section title={t('deals.history')}>
            <form onSubmit={onAddNote} className="mb-5">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('deals.notePlaceholder')}
                rows={2}
                maxLength={2000}
              />
              <div className="mt-2 flex justify-end">
                <Button type="submit" size="sm" loading={addNote.isPending} disabled={!note.trim()}>
                  {t('deals.addNote')}
                </Button>
              </div>
            </form>
            {activities.isLoading ? (
              <Spinner />
            ) : (
              <ul>
                {(activities.data ?? []).map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {editing && <DealForm onClose={() => setEditing(false)} deal={d} />}

      <Modal
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        title={t('deals.lostTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLostOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!lostReason.trim()}
              onClick={() => {
                moveTo('lost', lostReason)
                setLostOpen(false)
              }}
            >
              {t('stages.lost')}
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          placeholder={t('deals.lostPlaceholder')}
          maxLength={200}
        />
      </Modal>
    </>
  )
}
