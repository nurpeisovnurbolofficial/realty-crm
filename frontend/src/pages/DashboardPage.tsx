import { AlertTriangle, CheckSquare, Clock, Percent, TrendingUp, Wallet } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useDashboard, useUsers } from '../api/hooks'
import { useAuth } from '../auth/context'
import { useMoney } from '../lib/hooks'
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Select, Spinner } from '../components/ui'
import { formatMonth } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const STAGE_COLORS = ['#94a3b8', '#3b82f6', '#6366f1', '#f59e0b', '#8b5cf6']

function Kpi({
  icon,
  label,
  value,
  hint,
  hintTo,
  alert,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
  hintTo?: string
  alert?: { text: string; to: string }
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="rounded-lg bg-brand-50 p-1.5 text-brand-700">{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500">
          {hintTo ? (
            <Link to={hintTo} className="hover:text-brand-700 hover:underline">
              {hint}
            </Link>
          ) : (
            hint
          )}
        </div>
      )}
      {alert && (
        <Link
          to={alert.to}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          <AlertTriangle className="size-3" /> {alert.text}
        </Link>
      )}
    </Card>
  )
}

function ChartCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const money = useMoney()
  useDocumentTitle(t('nav.dashboard'))
  const [owner, setOwner] = useState('')
  const dashboard = useDashboard({ owner })
  const users = useUsers()

  if (dashboard.isLoading) return <Spinner />
  if (dashboard.isError || !dashboard.data) return <ErrorState onRetry={() => void dashboard.refetch()} />
  const data = dashboard.data

  const byStage = data.by_stage.map((row) => ({ ...row, name: t(`stages.${row.stage}`) }))
  const monthly = data.monthly.map((row) => ({ ...row, name: formatMonth(row.month, i18n.language) }))
  const managers = (users.data ?? []).filter((u) => u.role === 'manager')

  return (
    <>
      <PageHeader
        title={t('dashboard.hello', { name: user?.first_name || user?.display_name })}
        subtitle={user?.is_head ? t('dashboard.subtitle') : t('dashboard.subtitleManager')}
        actions={
          user?.is_head && (
            <Select
              aria-label={t('dashboard.manager')}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder={t('dashboard.allManagers')}
              options={managers.map((m) => ({ value: m.id, label: m.display_name }))}
              className="w-52"
            />
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Kpi
          icon={<Wallet className="size-4" />}
          label={t('dashboard.pipeline')}
          value={money(data.pipeline.amount, true)}
          hint={t('dashboard.pipelineHint', {
            count: data.pipeline.count,
            commission: money(data.pipeline.commission, true),
          })}
        />
        <Kpi
          icon={<TrendingUp className="size-4" />}
          label={t('dashboard.wonThisMonth')}
          value={money(data.won_this_month.amount, true)}
          hint={t('dashboard.wonHint', {
            count: data.won_this_month.count,
            commission: money(data.won_this_month.commission, true),
          })}
        />
        <Kpi
          icon={<Percent className="size-4" />}
          label={t('dashboard.conversion')}
          value={data.conversion_rate === null ? '—' : `${data.conversion_rate}%`}
          hint={t('dashboard.conversionHint')}
        />
        <Kpi
          icon={<Clock className="size-4" />}
          label={t('dashboard.avgDays')}
          value={
            data.avg_days_to_close === null ? '—' : t('dashboard.days', { count: Math.round(data.avg_days_to_close) })
          }
          hint={t('dashboard.avgHint')}
        />
        <Kpi
          icon={<CheckSquare className="size-4" />}
          label={t('dashboard.todayTasks')}
          value={String(data.tasks.today)}
          hint={t('dashboard.allTasks')}
          hintTo="/tasks"
          alert={
            data.tasks.overdue
              ? { text: t('dashboard.overdue', { count: data.tasks.overdue }), to: '/tasks?when=overdue' }
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <ChartCard title={t('dashboard.monthly')} className="xl:col-span-3">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="commission" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => money(v, true)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={80}
                />
                <Tooltip formatter={(v) => money(Number(v))} labelClassName="font-medium" />
                <Area
                  type="monotone"
                  dataKey="commission"
                  name={t('dashboard.commission')}
                  stroke="#0f766e"
                  strokeWidth={2}
                  fill="url(#commission)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={t('dashboard.byStage')} className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStage} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={95} />
                <Tooltip
                  formatter={(v, _name, item) => [
                    `${v} · ${money(Number(item.payload.amount), true)}`,
                    t('dashboard.deals'),
                  ]}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {byStage.map((row, index) => (
                    <Cell key={row.stage} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        {data.leaderboard && (
          <ChartCard title={t('dashboard.leaderboard')} className="xl:col-span-3">
            <div className="-mx-5 -my-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-5 py-2 font-medium">{t('dashboard.manager')}</th>
                    <th className="px-5 py-2 text-right font-medium">{t('dashboard.wonDeals')}</th>
                    <th className="px-5 py-2 text-right font-medium">{t('dashboard.activeDeals')}</th>
                    <th className="px-5 py-2 text-right font-medium">{t('dashboard.commission')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.leaderboard.map((row, index) => (
                    <tr key={row.id}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-4 text-xs text-slate-400">{index + 1}</span>
                          <Avatar name={row.name} />
                          <span className="font-medium text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">{row.won_count}</td>
                      <td className="px-5 py-3 text-right">{row.active_deals}</td>
                      <td className="px-5 py-3 text-right font-semibold text-brand-700">{money(row.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        )}

        <ChartCard title={t('dashboard.lostReasons')} className={data.leaderboard ? 'xl:col-span-2' : 'xl:col-span-5'}>
          {data.lost_reasons.length === 0 ? (
            <EmptyState text={t('dashboard.noData')} />
          ) : (
            <ul className="space-y-3">
              {data.lost_reasons.map((row) => {
                const max = data.lost_reasons[0].count
                return (
                  <li key={row.reason}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-slate-700">{row.reason}</span>
                      <span className="font-medium text-slate-900">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-red-400" style={{ width: `${(row.count / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ChartCard>
      </div>
    </>
  )
}
