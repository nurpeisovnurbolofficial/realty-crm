import type { BadgeColor } from '../components/ui'
import type { Stage } from '../api/types'

export const stageColors: Record<Stage, BadgeColor> = {
  new: 'slate',
  contacted: 'blue',
  viewing: 'indigo',
  negotiation: 'amber',
  contract: 'violet',
  won: 'green',
  lost: 'red',
}

export const stageAccent: Record<Stage, string> = {
  new: 'bg-slate-400',
  contacted: 'bg-blue-500',
  viewing: 'bg-indigo-500',
  negotiation: 'bg-amber-500',
  contract: 'bg-violet-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
}
