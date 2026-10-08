/** Components that know about the CRM domain: stages, property types and statuses. */
import clsx from 'clsx'
import { Building2, Home, LandPlot, Store } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { PropertyKind, PropertyStatus, Stage } from '../api/types'
import { stageColors } from '../lib/stages'
import { Badge, type BadgeColor } from './ui'

export function StageBadge({ stage }: { stage: Stage }) {
  const { t } = useTranslation()
  return <Badge color={stageColors[stage]}>{t(`stages.${stage}`)}</Badge>
}

const statusColors: Record<PropertyStatus, BadgeColor> = {
  available: 'green',
  reserved: 'amber',
  sold: 'slate',
  rented: 'slate',
}

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  const { t } = useTranslation()
  return <Badge color={statusColors[status]}>{t(`propertyStatuses.${status}`)}</Badge>
}

const kindIcons = { apartment: Building2, house: Home, commercial: Store, land: LandPlot }
const kindGradients: Record<PropertyKind, string> = {
  apartment: 'from-teal-500 to-cyan-600',
  house: 'from-emerald-500 to-teal-600',
  commercial: 'from-indigo-500 to-blue-600',
  land: 'from-lime-500 to-green-600',
}

/** Placeholder "photo" for a listing: a gradient with an icon of the property type. */
export function PropertyCover({ kind, className }: { kind: PropertyKind; className?: string }) {
  const Icon = kindIcons[kind]
  return (
    <div
      className={clsx(
        'flex items-center justify-center bg-gradient-to-br text-white/90',
        kindGradients[kind],
        className,
      )}
    >
      <Icon className="size-10" strokeWidth={1.5} />
    </div>
  )
}

export function PropertyKindIcon({ kind, className }: { kind: PropertyKind; className?: string }) {
  const Icon = kindIcons[kind]
  return <Icon className={className} />
}
