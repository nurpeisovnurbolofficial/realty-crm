import { Building, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClientCrud, useClients, useUsers } from '../api/hooks'
import { type Client, CLIENT_SOURCES, type ClientKind, type ClientSource } from '../api/types'
import { useAuth } from '../auth/context'
import { useErrorText } from '../lib/hooks'
import { Pagination } from '../components/Pagination'
import { useToast } from '../lib/toast'
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormError,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../components/ui'
import { useDebounced } from '../lib/useDebounced'

const PAGE_SIZE = 20

const emptyForm = {
  name: '',
  kind: 'person' as ClientKind,
  company_name: '',
  phone: '',
  email: '',
  source: 'website' as ClientSource,
  notes: '',
  owner: '',
}

function initialClientForm(client: Client | null) {
  if (!client) return emptyForm
  return {
    name: client.name,
    kind: client.kind,
    company_name: client.company_name,
    phone: client.phone,
    email: client.email,
    source: client.source,
    notes: client.notes,
    owner: String(client.owner),
  }
}

function ClientForm({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const users = useUsers()
  const { save, remove } = useClientCrud()
  const toast = useToast()
  const errorText = useErrorText()
  const [form, setForm] = useState(() => initialClientForm(client))
  const [error, setError] = useState<string | null>(null)

  const set = (field: keyof typeof emptyForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const { owner, ...rest } = form
    try {
      await save.mutateAsync({ id: client?.id, ...rest, ...(user?.is_head && owner ? { owner: Number(owner) } : {}) })
      toast('success', t('common.saved'))
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function onDelete() {
    if (!client || !window.confirm(t('common.confirmDelete'))) return
    try {
      await remove.mutateAsync(client.id)
      toast('success', t('common.deleted'))
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? t('clients.edit') : t('clients.new')}
      wide
      footer={
        <>
          {client && !user?.demo_mode && (
            <Button
              variant="danger"
              className="mr-auto"
              icon={<Trash2 className="size-4" />}
              onClick={() => void onDelete()}
              loading={remove.isPending}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="client-form" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <FormError message={error} />
      <form id="client-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input label={t('clients.name')} value={form.name} onChange={set('name')} required />
        <Select
          label={t('clients.kind')}
          value={form.kind}
          onChange={set('kind')}
          options={(['person', 'company'] as const).map((k) => ({ value: k, label: t(`clientKinds.${k}`) }))}
        />
        {form.kind === 'company' && (
          <Input
            label={t('clients.company')}
            value={form.company_name}
            onChange={set('company_name')}
            className="sm:col-span-2"
          />
        )}
        <Input label={t('clients.phone')} type="tel" value={form.phone} onChange={set('phone')} required />
        <Input label={t('clients.email')} type="email" value={form.email} onChange={set('email')} />
        <Select
          label={t('clients.source')}
          value={form.source}
          onChange={set('source')}
          options={CLIENT_SOURCES.map((s) => ({ value: s, label: t(`clientSources.${s}`) }))}
        />
        {user?.is_head && (
          <Select
            label={t('clients.owner')}
            value={form.owner}
            onChange={set('owner')}
            placeholder={user.display_name}
            options={(users.data ?? []).map((u) => ({ value: u.id, label: u.display_name }))}
          />
        )}
        <Textarea label={t('clients.notes')} value={form.notes} onChange={set('notes')} className="sm:col-span-2" />
      </form>
    </Modal>
  )
}

export function ClientsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounced(search)
  const clients = useClients({ search: debouncedSearch, source, page, page_size: PAGE_SIZE })
  const [editing, setEditing] = useState<Client | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const open = (client: Client | null) => {
    setEditing(client)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title={t('clients.title')}
        subtitle={t('clients.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => open(null)}>
            {t('clients.new')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t('common.search')}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
        </div>
        <Select
          aria-label={t('clients.source')}
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            setPage(1)
          }}
          placeholder={`${t('clients.source')}: ${t('common.all')}`}
          options={CLIENT_SOURCES.map((s) => ({ value: s, label: t(`clientSources.${s}`) }))}
          className="w-52"
        />
      </div>

      <Card className="overflow-hidden">
        {clients.isLoading && <Spinner />}
        {clients.isError && <ErrorState onRetry={() => void clients.refetch()} />}
        {clients.data &&
          (clients.data.results.length === 0 ? (
            <EmptyState text={t('common.empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('clients.name')}</th>
                    <th className="px-5 py-3 font-medium">{t('clients.phone')}</th>
                    <th className="hidden px-5 py-3 font-medium md:table-cell">{t('clients.source')}</th>
                    {user?.is_head && (
                      <th className="hidden px-5 py-3 font-medium lg:table-cell">{t('clients.owner')}</th>
                    )}
                    <th className="px-5 py-3 text-right font-medium">{t('clients.deals')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.data.results.map((client) => (
                    <tr key={client.id} onClick={() => open(client)} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-lg bg-slate-100 p-1.5 text-slate-500">
                            {client.kind === 'company' ? (
                              <Building className="size-4" />
                            ) : (
                              <UserRound className="size-4" />
                            )}
                          </span>
                          <div>
                            <div className="font-medium text-slate-900">{client.name}</div>
                            {client.company_name && <div className="text-xs text-slate-500">{client.company_name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-slate-600">{client.phone}</td>
                      <td className="hidden px-5 py-3 md:table-cell">
                        <Badge>{t(`clientSources.${client.source}`)}</Badge>
                      </td>
                      {user?.is_head && (
                        <td className="hidden px-5 py-3 lg:table-cell">
                          <span className="inline-flex items-center gap-2 text-slate-600">
                            <Avatar name={client.owner_info.display_name} className="size-6 text-[10px]" />
                            {client.owner_info.display_name}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3 text-right font-medium text-slate-900">{client.deals_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </Card>
      {clients.data && <Pagination page={page} pageSize={PAGE_SIZE} total={clients.data.count} onChange={setPage} />}

      {formOpen && <ClientForm client={editing} onClose={() => setFormOpen(false)} />}
    </>
  )
}
