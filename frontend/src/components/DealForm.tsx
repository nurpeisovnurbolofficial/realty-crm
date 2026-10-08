import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClients, useProperties, useSaveDeal, useUsers } from '../api/hooks'
import type { Deal, DealType } from '../api/types'
import { useAuth } from '../auth/context'
import { useFormErrors } from '../lib/forms'
import { useMoney } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { Button, FormError, Input, Modal, Select } from './ui'

interface Props {
  onClose: () => void
  deal?: Deal
  onSaved?: (deal: Deal) => void
}

const empty = {
  title: '',
  client: '',
  property: '',
  deal_type: 'sale' as DealType,
  amount: '',
  commission_percent: '3',
  expected_close_date: '',
  owner: '',
}

function initialForm(deal?: Deal) {
  if (!deal) return empty
  return {
    title: deal.title,
    client: String(deal.client),
    property: deal.property ? String(deal.property) : '',
    deal_type: deal.deal_type,
    amount: String(deal.amount),
    commission_percent: String(Number(deal.commission_percent)),
    expected_close_date: deal.expected_close_date ?? '',
    owner: String(deal.owner),
  }
}

/** Mount it only while open (`{open && <DealForm …/>}`): every opening starts from fresh initial values. */
export function DealForm({ onClose, deal, onSaved }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const money = useMoney()
  const toast = useToast()
  const save = useSaveDeal()
  const errors = useFormErrors()
  const [form, setForm] = useState(() => initialForm(deal))

  const clients = useClients({ page_size: 100, ordering: 'name' })
  const properties = useProperties({ page_size: 100, deal_type: form.deal_type, ordering: '-created_at' })
  const users = useUsers()

  const set = (field: keyof typeof empty) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  // Choosing a property fills in the amount (if it is still empty).
  function onPropertyChange(value: string) {
    const prop = properties.data?.results.find((p) => String(p.id) === value)
    setForm((current) => ({
      ...current,
      property: value,
      amount: prop && !current.amount ? String(prop.price) : current.amount,
    }))
  }

  // The usual agency commission: 3% of the price for a sale, 50% of a month's rent for a rent.
  function onTypeChange(value: DealType) {
    setForm((current) => ({
      ...current,
      deal_type: value,
      property: '',
      commission_percent: value === 'rent' ? '50' : '3',
    }))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    errors.clear()
    try {
      const saved = await save.mutateAsync({
        id: deal?.id,
        title: form.title,
        client: Number(form.client),
        property: form.property ? Number(form.property) : null,
        deal_type: form.deal_type,
        amount: Number(form.amount || 0),
        commission_percent: form.commission_percent,
        expected_close_date: form.expected_close_date || null,
        ...(user?.is_head && form.owner ? { owner: Number(form.owner) } : {}),
      })
      toast('success', t('common.saved'))
      onSaved?.(saved)
      onClose()
    } catch (err) {
      errors.setError(err)
    }
  }

  // Properties already taken by other deals are hidden, except the one attached to this deal.
  const propertyOptions = (properties.data?.results ?? [])
    .filter((p) => p.status === 'available' || String(p.id) === form.property)
    .map((p) => ({ value: p.id, label: `${p.title} · ${money(p.price, true)}` }))

  const amount = Number(form.amount || 0)
  const commission = (amount * Number(form.commission_percent || 0)) / 100

  return (
    <Modal
      open
      onClose={onClose}
      title={deal ? t('deals.edit') : t('deals.new')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="deal-form" loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <FormError message={errors.formError} />
      <form id="deal-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('deals.name')}
          value={form.title}
          onChange={set('title')}
          required
          error={errors.field('title')}
          className="sm:col-span-2"
        />
        <Select
          label={t('deals.client')}
          value={form.client}
          onChange={set('client')}
          required
          error={errors.field('client')}
          placeholder={t('deals.selectClient')}
          options={(clients.data?.results ?? []).map((c) => ({
            value: c.id,
            label: c.company_name ? `${c.name} (${c.company_name})` : c.name,
          }))}
        />
        <Select
          label={t('deals.type')}
          value={form.deal_type}
          onChange={(e) => onTypeChange(e.target.value as DealType)}
          error={errors.field('deal_type')}
          options={[
            { value: 'sale', label: t('dealTypes.sale') },
            { value: 'rent', label: t('dealTypes.rent') },
          ]}
        />
        <Select
          label={t('deals.property')}
          value={form.property}
          onChange={(e) => onPropertyChange(e.target.value)}
          error={errors.field('property')}
          placeholder={t('deals.noProperty')}
          options={propertyOptions}
          className="sm:col-span-2"
        />
        <Input
          label={t('deals.amount')}
          type="number"
          min={0}
          step={10000}
          value={form.amount}
          onChange={set('amount')}
          error={errors.field('amount')}
          hint={amount > 0 ? t('deals.total', { value: money(amount) }) : undefined}
        />
        <Input
          label={t('deals.commissionPercent')}
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={form.commission_percent}
          onChange={set('commission_percent')}
          error={errors.field('commission_percent')}
          hint={commission > 0 ? `${t('deals.commission')}: ${money(commission)}` : undefined}
        />
        <Input
          label={t('deals.expectedClose')}
          type="date"
          value={form.expected_close_date}
          onChange={set('expected_close_date')}
          error={errors.field('expected_close_date')}
        />
        {user?.is_head && (
          <Select
            label={t('deals.owner')}
            value={form.owner}
            onChange={set('owner')}
            error={errors.field('owner')}
            placeholder={user.display_name}
            options={(users.data ?? [])
              .filter((u) => u.role === 'manager')
              .map((u) => ({ value: u.id, label: u.display_name }))}
          />
        )}
      </form>
    </Modal>
  )
}
