/**
 * Small, reusable UI building blocks styled with Tailwind.
 * Keeping them in one place gives every page the same look.
 */
import clsx from 'clsx'
import { Loader2, X } from 'lucide-react'
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useId,
} from 'react'
import { useTranslation } from 'react-i18next'

import { initials } from '../../lib/format'

// --- Buttons ------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

// --- Form fields --------------------------------------------------------------

const fieldClass =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100 focus:outline-none ' +
  'disabled:bg-slate-100 disabled:text-slate-500'

function FieldWrapper({
  label,
  id,
  children,
  className,
}: {
  label?: string
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
          {label}
        </label>
      )}
      {children}
    </div>
  )
}

export function Input({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const id = useId()
  return (
    <FieldWrapper label={label} id={id} className={className}>
      <input id={id} {...rest} className={fieldClass} />
    </FieldWrapper>
  )
}

export function Textarea({
  label,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const id = useId()
  return (
    <FieldWrapper label={label} id={id} className={className}>
      <textarea id={id} rows={3} {...rest} className={fieldClass} />
    </FieldWrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: { value: string | number; label: string }[]
  placeholder?: string
}

export function Select({ label, options, placeholder, className, ...rest }: SelectProps) {
  const id = useId()
  return (
    <FieldWrapper label={label} id={id} className={className}>
      <select id={id} {...rest} className={clsx(fieldClass, 'pr-8')}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  )
}

// --- Layout pieces ------------------------------------------------------------

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Badge({
  children,
  color = 'slate',
  className,
}: {
  children: ReactNode
  color?: BadgeColor
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        badgeColors[color],
        className,
      )}
    >
      {children}
    </span>
  )
}

export type BadgeColor = 'slate' | 'blue' | 'indigo' | 'amber' | 'violet' | 'teal' | 'green' | 'red'
const badgeColors: Record<BadgeColor, string> = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
  teal: 'bg-teal-50 text-teal-700',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      title={name}
      className={clsx(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function Spinner({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-12 text-sm text-slate-500', className)}>
      <Loader2 className="size-5 animate-spin" /> {t('common.loading')}
    </div>
  )
}

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-slate-500">
      {icon}
      {text}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-500">
      {t('common.error')}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

// --- Modal --------------------------------------------------------------------

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ open, title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={clsx(
          'flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>
}

// --- Tabs / segmented control ---------------------------------------------------

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === option.value ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
