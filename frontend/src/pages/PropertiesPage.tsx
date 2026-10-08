import { BedDouble, Layers, MapPin, Plus, Ruler, Trash2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { useProperties, useProperty, usePropertyCrud } from '../api/hooks'
import { useAuth } from '../auth/context'
import {
  type DealType,
  type District,
  DISTRICTS,
  type Property,
  PROPERTY_KINDS,
  PROPERTY_STATUSES,
  type PropertyKind,
  type PropertyStatus,
} from '../api/types'
import { PropertyCover, PropertyStatusBadge } from '../components/domain'
import { useConfirm } from '../lib/confirm'
import { useFormErrors } from '../lib/forms'
import { useMoney } from '../lib/hooks'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { Pagination } from '../components/Pagination'
import { useToast } from '../lib/toast'
import {
  Avatar,
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
  Textarea,
} from '../components/ui'
import { useDebounced } from '../lib/useDebounced'

const PAGE_SIZE = 12

const emptyForm = {
  title: '',
  kind: 'apartment' as PropertyKind,
  deal_type: 'sale' as DealType,
  district: 'esil' as District,
  address: 'Astana, ',
  rooms: '',
  area: '',
  floor: '',
  price: '',
  status: 'available' as PropertyStatus,
  description: '',
}

function initialPropertyForm(property: Property | null) {
  if (!property) return emptyForm
  return {
    title: property.title,
    kind: property.kind,
    deal_type: property.deal_type,
    district: property.district,
    address: property.address,
    rooms: property.rooms?.toString() ?? '',
    area: String(Number(property.area)),
    floor: property.floor?.toString() ?? '',
    price: String(property.price),
    status: property.status,
    description: property.description,
  }
}

function PropertyForm({ property, onClose }: { property: Property | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { save, remove } = usePropertyCrud()
  const toast = useToast()
  const confirm = useConfirm()
  const money = useMoney()
  const errors = useFormErrors()
  const [form, setForm] = useState(() => initialPropertyForm(property))
  // Rooms make no sense for land and commercial space; a floor makes no sense for land or a house.
  const showRooms = form.kind === 'apartment' || form.kind === 'house'
  const showFloor = form.kind === 'apartment' || form.kind === 'commercial'
  const readOnly = property !== null && !property.can_edit

  const set = (field: keyof typeof emptyForm) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    errors.clear()
    const toNumber = (value: string) => (value === '' ? null : Number(value))
    try {
      await save.mutateAsync({
        id: property?.id,
        ...form,
        rooms: showRooms ? toNumber(form.rooms) : null,
        floor: showFloor ? toNumber(form.floor) : null,
        price: Number(form.price),
        area: form.area,
        // "reserved" is set only by deals, so we never send it (undefined is dropped from JSON)
        status: form.status === 'reserved' ? undefined : form.status,
      })
      toast('success', t('common.saved'))
      onClose()
    } catch (err) {
      errors.setError(err)
    }
  }

  async function onDelete() {
    if (!property || !(await confirm({ title: property.title, text: t('common.confirmDelete') }))) return
    try {
      await remove.mutateAsync(property.id)
      toast('success', t('common.deleted'))
      onClose()
    } catch (err) {
      errors.setError(err)
    }
  }

  const title = !property ? t('properties.new') : readOnly ? t('properties.view') : t('properties.edit')
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      wide
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        ) : (
          <>
            {property && !user?.demo_mode && (
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
            <Button type="submit" form="property-form" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </>
        )
      }
    >
      {readOnly && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('properties.readOnly')}</div>
      )}
      <FormError message={errors.formError} />
      <form id="property-form" onSubmit={onSubmit}>
        <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('properties.name')}
            value={form.title}
            onChange={set('title')}
            required
            error={errors.field('title')}
            className="sm:col-span-2"
          />
          <Select
            label={t('properties.kind')}
            value={form.kind}
            onChange={set('kind')}
            options={PROPERTY_KINDS.map((k) => ({ value: k, label: t(`propertyKinds.${k}`) }))}
          />
          <Select
            label={t('properties.dealType')}
            value={form.deal_type}
            onChange={set('deal_type')}
            error={errors.field('deal_type')}
            options={(['sale', 'rent'] as const).map((k) => ({ value: k, label: t(`dealTypes.${k}`) }))}
          />
          <Select
            label={t('properties.district')}
            value={form.district}
            onChange={set('district')}
            options={DISTRICTS.map((d) => ({ value: d, label: t(`districts.${d}`) }))}
          />
          <Input
            label={t('properties.address')}
            value={form.address}
            onChange={set('address')}
            required
            error={errors.field('address')}
          />
          <Input
            label={t('properties.price')}
            type="number"
            min={0}
            step={10000}
            value={form.price}
            onChange={set('price')}
            required
            error={errors.field('price')}
            hint={Number(form.price) > 0 ? money(Number(form.price)) : undefined}
          />
          <Input
            label={t('properties.area')}
            type="number"
            min={1}
            step={0.1}
            value={form.area}
            onChange={set('area')}
            required
            error={errors.field('area')}
          />
          {showRooms && (
            <Input
              label={t('properties.rooms')}
              type="number"
              min={0}
              value={form.rooms}
              onChange={set('rooms')}
              error={errors.field('rooms')}
            />
          )}
          {showFloor && (
            <Input
              label={t('properties.floor')}
              type="number"
              value={form.floor}
              onChange={set('floor')}
              error={errors.field('floor')}
            />
          )}
          <Select
            label={t('properties.status')}
            value={form.status}
            onChange={set('status')}
            disabled={form.status === 'reserved'}
            error={errors.field('status')}
            options={PROPERTY_STATUSES.filter((s) => s !== 'reserved' || form.status === 'reserved').map((s) => ({
              value: s,
              label: t(`propertyStatuses.${s}`),
            }))}
          />
          <Textarea
            label={t('properties.description')}
            value={form.description}
            onChange={set('description')}
            className="sm:col-span-2"
          />
        </fieldset>
      </form>
    </Modal>
  )
}

function PropertyCard({ property, onOpen }: { property: Property; onOpen: () => void }) {
  const { t } = useTranslation()
  const money = useMoney()
  return (
    <button type="button" onClick={onOpen} className="text-left">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative">
          <PropertyCover kind={property.kind} className="h-32" />
          <div className="absolute top-3 left-3 flex gap-1.5">
            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-slate-800">
              {t(`dealTypes.${property.deal_type}`)}
            </span>
          </div>
          <div className="absolute top-3 right-3">
            <PropertyStatusBadge status={property.status} />
          </div>
        </div>
        <div className="p-4">
          <div className="text-lg font-semibold text-slate-900">
            {money(property.price)}
            {property.deal_type === 'rent' && (
              <span className="text-sm font-normal text-slate-500"> {t('common.perMonth')}</span>
            )}
          </div>
          <div className="mt-1 line-clamp-1 text-sm font-medium text-slate-700">{property.title}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" /> {t(`districts.${property.district}`)} ·{' '}
            {property.address.replace('Astana, ', '')}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Ruler className="size-3.5" /> {Number(property.area)} {t('common.sqm')}
            </span>
            {property.rooms !== null && (
              <span className="flex items-center gap-1">
                <BedDouble className="size-3.5" /> {t('common.rooms', { count: property.rooms })}
              </span>
            )}
            {property.floor !== null && (
              <span className="flex items-center gap-1">
                <Layers className="size-3.5" /> {t('common.floor', { floor: property.floor })}
              </span>
            )}
            <Avatar name={property.agent_info.display_name} className="ml-auto size-6 text-[10px]" />
          </div>
        </div>
      </Card>
    </button>
  )
}

export function PropertiesPage() {
  const { t } = useTranslation()
  useDocumentTitle(t('nav.properties'))
  const [params, setParams] = useSearchParams()
  const [dealType, setDealType] = useState<'' | DealType>('')
  const [kind, setKind] = useState('')
  const [district, setDistrict] = useState('')
  const [status, setStatus] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [roomsMin, setRoomsMin] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const debounced = useDebounced({ search, priceMin, priceMax })
  const filters = useMemo(
    () => ({
      deal_type: dealType,
      kind,
      district,
      status,
      rooms_min: roomsMin,
      search: debounced.search,
      price_min: debounced.priceMin,
      price_max: debounced.priceMax,
      page,
      page_size: PAGE_SIZE,
    }),
    [dealType, kind, district, status, roomsMin, debounced, page],
  )
  const properties = useProperties(filters)
  const [editing, setEditing] = useState<Property | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  // Opening a listing by link, e.g. from a deal page: /properties?open=12
  const openId = params.get('open')
  const linked = useProperty(openId ? Number(openId) : null)

  /** Any filter change starts again from the first page. */
  function withReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  function reset() {
    setPage(1)
    setDealType('')
    setKind('')
    setDistrict('')
    setStatus('')
    setPriceMin('')
    setPriceMax('')
    setRoomsMin('')
    setSearch('')
  }

  return (
    <>
      <PageHeader
        title={t('properties.title')}
        subtitle={t('properties.subtitle')}
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('properties.new')}
          </Button>
        }
      />

      <Card className="mb-5 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented
            value={dealType}
            onChange={withReset(setDealType)}
            options={[
              { value: '', label: t('common.all') },
              { value: 'sale', label: t('dealTypes.sale') },
              { value: 'rent', label: t('dealTypes.rent') },
            ]}
          />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => withReset(setSearch)(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
            {t('properties.reset')}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select
            aria-label={t('properties.kind')}
            value={kind}
            onChange={(e) => withReset(setKind)(e.target.value)}
            placeholder={t('properties.kind')}
            options={PROPERTY_KINDS.map((k) => ({ value: k, label: t(`propertyKinds.${k}`) }))}
          />
          <Select
            aria-label={t('properties.district')}
            value={district}
            onChange={(e) => withReset(setDistrict)(e.target.value)}
            placeholder={t('properties.district')}
            options={DISTRICTS.map((d) => ({ value: d, label: t(`districts.${d}`) }))}
          />
          <Select
            aria-label={t('properties.status')}
            value={status}
            onChange={(e) => withReset(setStatus)(e.target.value)}
            placeholder={t('properties.status')}
            options={PROPERTY_STATUSES.map((s) => ({ value: s, label: t(`propertyStatuses.${s}`) }))}
          />
          <Select
            aria-label={t('properties.roomsMin')}
            value={roomsMin}
            onChange={(e) => withReset(setRoomsMin)(e.target.value)}
            placeholder={t('properties.roomsMin')}
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n}+` }))}
          />
          <Input
            aria-label={t('properties.priceMin')}
            type="number"
            min={0}
            placeholder={t('properties.priceMin')}
            value={priceMin}
            onChange={(e) => withReset(setPriceMin)(e.target.value)}
          />
          <Input
            aria-label={t('properties.priceMax')}
            type="number"
            min={0}
            placeholder={t('properties.priceMax')}
            value={priceMax}
            onChange={(e) => withReset(setPriceMax)(e.target.value)}
          />
        </div>
      </Card>

      {properties.isLoading && <Spinner />}
      {properties.isError && <ErrorState onRetry={() => void properties.refetch()} />}
      {properties.data &&
        (properties.data.results.length === 0 ? (
          <EmptyState text={t('common.empty')} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {properties.data.results.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onOpen={() => {
                  setEditing(property)
                  setFormOpen(true)
                }}
              />
            ))}
          </div>
        ))}
      {properties.data && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={properties.data.count} onChange={setPage} />
      )}

      {formOpen && <PropertyForm property={editing} onClose={() => setFormOpen(false)} />}
      {linked.data && !formOpen && (
        <PropertyForm key={linked.data.id} property={linked.data} onClose={() => setParams({}, { replace: true })} />
      )}
    </>
  )
}
