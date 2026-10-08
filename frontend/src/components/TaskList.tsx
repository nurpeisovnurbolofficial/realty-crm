import clsx from 'clsx'
import { Check, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useTaskCrud, useToggleTask } from '../api/hooks'
import type { Task } from '../api/types'
import { formatDateTime, toLocalInput } from '../lib/format'
import { useErrorText } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { Avatar, Button } from './ui'

export function TaskRow({
  task,
  showDeal = true,
  showAssignee = false,
}: {
  task: Task
  showDeal?: boolean
  showAssignee?: boolean
}) {
  const { t, i18n } = useTranslation()
  const toggle = useToggleTask()
  const toast = useToast()
  const errorText = useErrorText()

  return (
    <li className="flex items-start gap-3 py-3">
      <button
        type="button"
        onClick={() =>
          toggle.mutate({ id: task.id, done: !task.is_done }, { onError: (e) => toast('error', errorText(e)) })
        }
        disabled={toggle.isPending}
        aria-label={task.title}
        className={clsx(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          task.is_done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-600',
        )}
      >
        {task.is_done && <Check className="size-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={clsx('text-sm', task.is_done ? 'text-slate-400 line-through' : 'text-slate-800')}>
          {task.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className={clsx(task.is_overdue && 'font-medium text-red-600')}>
            {formatDateTime(task.due_at, i18n.language)}
          </span>
          {showDeal &&
            (task.deal ? (
              <Link to={`/deals/${task.deal}`} className="text-brand-700 hover:underline">
                {task.deal_title}
              </Link>
            ) : (
              <span>{t('tasks.noDeal')}</span>
            ))}
        </div>
      </div>
      {showAssignee && <Avatar name={task.assignee_info.display_name} />}
    </li>
  )
}

/** Quick "add a task" line used on the deal page. */
export function AddTaskForm({ dealId }: { dealId: number }) {
  const { t } = useTranslation()
  const { save } = useTaskCrud()
  const toast = useToast()
  const errorText = useErrorText()
  const [title, setTitle] = useState('')
  // Default due time: tomorrow at 11:00. Computed once, not on every render.
  const [due, setDue] = useState(() => {
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
    tomorrow.setHours(11, 0, 0, 0)
    return toLocalInput(tomorrow)
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    try {
      await save.mutateAsync({ title, deal: dealId, due_at: new Date(due).toISOString() })
      setTitle('')
    } catch (error) {
      toast('error', errorText(error))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('tasks.name')}
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
      <input
        type="datetime-local"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label={t('tasks.due')}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
      />
      <Button type="submit" variant="secondary" icon={<Plus className="size-4" />} loading={save.isPending}>
        {t('common.create')}
      </Button>
    </form>
  )
}
