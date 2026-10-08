import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useBoard, useTaskCrud, useTasks, useUsers } from '../api/hooks'
import { OPEN_STAGES } from '../api/types'
import { useAuth } from '../auth/context'
import { useErrorText } from '../lib/hooks'
import { Pagination } from '../components/Pagination'
import { TaskRow } from '../components/TaskList'
import { useToast } from '../lib/toast'
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormError,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  Spinner,
} from '../components/ui'
import { toLocalInput } from '../lib/format'

type When = 'overdue' | 'today' | 'upcoming' | 'done'
const PAGE_SIZE = 20

function NewTaskModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const users = useUsers()
  const board = useBoard({})
  const { save } = useTaskCrud()
  const toast = useToast()
  const errorText = useErrorText()
  const [title, setTitle] = useState('')
  const [deal, setDeal] = useState('')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)))
  const [error, setError] = useState<string | null>(null)

  const openDeals = OPEN_STAGES.flatMap((stage) => board.data?.[stage] ?? [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    try {
      await save.mutateAsync({
        title,
        deal: deal ? Number(deal) : null,
        due_at: new Date(due).toISOString(),
        ...(user?.is_head && assignee ? { assignee: Number(assignee) } : {}),
      })
      toast('success', t('common.saved'))
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('tasks.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="task-form" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <FormError message={error} />
      <form id="task-form" onSubmit={onSubmit} className="grid gap-4">
        <Input label={t('tasks.name')} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <Input
          label={t('tasks.due')}
          type="datetime-local"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          required
        />
        <Select
          label={t('tasks.deal')}
          value={deal}
          onChange={(e) => setDeal(e.target.value)}
          placeholder={t('tasks.noDeal')}
          options={openDeals.map((d) => ({ value: d.id, label: d.title }))}
        />
        {user?.is_head && (
          <Select
            label={t('tasks.assignee')}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            placeholder={user.display_name}
            options={(users.data ?? []).map((u) => ({ value: u.id, label: u.display_name }))}
          />
        )}
      </form>
    </Modal>
  )
}

export function TasksPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [when, setWhen] = useState<When>('today')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const tasks = useTasks({ when, page, page_size: PAGE_SIZE })

  return (
    <>
      <PageHeader
        title={t('tasks.title')}
        subtitle={t('tasks.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            {t('tasks.new')}
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          value={when}
          onChange={(value) => {
            setWhen(value)
            setPage(1)
          }}
          options={(['overdue', 'today', 'upcoming', 'done'] as const).map((value) => ({
            value,
            label: t(`tasks.${value}`),
          }))}
        />
      </div>
      <Card className="px-5">
        {tasks.isLoading && <Spinner />}
        {tasks.isError && <ErrorState onRetry={() => void tasks.refetch()} />}
        {tasks.data &&
          (tasks.data.results.length === 0 ? (
            <EmptyState text={t('tasks.empty')} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.data.results.map((task) => (
                <TaskRow key={task.id} task={task} showAssignee={user?.is_head} />
              ))}
            </ul>
          ))}
      </Card>
      {tasks.data && <Pagination page={page} pageSize={PAGE_SIZE} total={tasks.data.count} onChange={setPage} />}
      {creating && <NewTaskModal onClose={() => setCreating(false)} />}
    </>
  )
}
