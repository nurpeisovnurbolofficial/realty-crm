/**
 * Data hooks built on TanStack Query.
 *
 * TanStack Query caches server data by a "query key", shows cached data instantly,
 * refetches in the background and lets us invalidate related data after a change
 * (e.g. moving a deal refreshes the board, the deal page and the dashboard).
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from './client'
import type {
  Activity,
  Board,
  Client,
  Dashboard,
  Deal,
  DealListItem,
  DemoAccount,
  Paginated,
  Property,
  Stage,
  Task,
  User,
} from './types'

export type Filters = Record<string, string | number | boolean | null | undefined>

export const keys = {
  me: ['me'] as const,
  users: ['users'] as const,
  dashboard: (f: Filters) => ['dashboard', f] as const,
  board: (f: Filters) => ['board', f] as const,
  deal: (id: number) => ['deal', id] as const,
  activities: (id: number) => ['activities', id] as const,
  clients: (f: Filters) => ['clients', f] as const,
  properties: (f: Filters) => ['properties', f] as const,
  tasks: (f: Filters) => ['tasks', f] as const,
}

// --- Reading ------------------------------------------------------------------

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<User>('/api/auth/me/'), retry: false })

export const useDemoAccounts = () =>
  useQuery({ queryKey: ['demo-accounts'], queryFn: () => api<DemoAccount[]>('/api/auth/demo-accounts/') })

export const useUsers = () => useQuery({ queryKey: keys.users, queryFn: () => api<User[]>('/api/users/') })

export const useDashboard = (filters: Filters) =>
  useQuery({ queryKey: keys.dashboard(filters), queryFn: () => api<Dashboard>('/api/dashboard/', { params: filters }) })

export const useBoard = (filters: Filters) =>
  useQuery({ queryKey: keys.board(filters), queryFn: () => api<Board>('/api/deals/board/', { params: filters }) })

export const useDeal = (id: number) =>
  useQuery({ queryKey: keys.deal(id), queryFn: () => api<Deal>(`/api/deals/${id}/`) })

export const useActivities = (dealId: number) =>
  useQuery({ queryKey: keys.activities(dealId), queryFn: () => api<Activity[]>(`/api/deals/${dealId}/activities/`) })

export const useClients = (filters: Filters) =>
  useQuery({
    queryKey: keys.clients(filters),
    queryFn: () => api<Paginated<Client>>('/api/clients/', { params: filters }),
    placeholderData: keepPreviousData, // keep the table on screen while the next page loads
  })

export const useProperties = (filters: Filters) =>
  useQuery({
    queryKey: keys.properties(filters),
    queryFn: () => api<Paginated<Property>>('/api/properties/', { params: filters }),
    placeholderData: keepPreviousData,
  })

export const useProperty = (id: number | null) =>
  useQuery({
    queryKey: ['property', id],
    queryFn: () => api<Property>(`/api/properties/${id}/`),
    enabled: id !== null,
  })

export const useClient = (id: number | null) =>
  useQuery({
    queryKey: ['client', id],
    queryFn: () => api<Client>(`/api/clients/${id}/`),
    enabled: id !== null,
  })

/** Deals as a flat, paginated list (e.g. the deals of one client). */
export const useDeals = (filters: Filters) =>
  useQuery({
    queryKey: ['deals', filters],
    queryFn: () => api<Paginated<DealListItem>>('/api/deals/', { params: filters }),
  })

/** Number of tasks per tab: overdue / today / upcoming / done. */
export const useTaskSummary = () =>
  useQuery({
    queryKey: ['tasks', 'summary'],
    queryFn: () => api<Record<'overdue' | 'today' | 'upcoming' | 'done', number>>('/api/tasks/summary/'),
  })

export const useTasks = (filters: Filters) =>
  useQuery({
    queryKey: keys.tasks(filters),
    queryFn: () => api<Paginated<Task>>('/api/tasks/', { params: filters }),
    placeholderData: keepPreviousData,
  })

// --- Changing -----------------------------------------------------------------

/** After any change to deals, these screens may show stale numbers. */
function useInvalidateDeals() {
  const queryClient = useQueryClient()
  return (dealId?: number) => {
    queryClient.invalidateQueries({ queryKey: ['board'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['properties'] })
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['deals'] })
    if (dealId) {
      queryClient.invalidateQueries({ queryKey: keys.deal(dealId) })
      queryClient.invalidateQueries({ queryKey: keys.activities(dealId) })
    }
  }
}

/**
 * Move a deal on the Kanban board with an *optimistic update*:
 * the card jumps to the new column immediately, and jumps back if the server says no.
 */
export function useMoveDeal(boardFilters: Filters) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDeals()
  const boardKey = keys.board(boardFilters)

  return useMutation({
    mutationFn: ({ id, stage, lostReason }: { id: number; stage: Stage; lostReason?: string }) =>
      api<Deal>(`/api/deals/${id}/move/`, { method: 'POST', body: { stage, lost_reason: lostReason ?? '' } }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: boardKey })
      const previous = queryClient.getQueryData<Board>(boardKey)
      if (previous) queryClient.setQueryData<Board>(boardKey, moveCard(previous, id, stage))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(boardKey, context.previous) // roll back
    },
    onSettled: (_data, _error, vars) => invalidate(vars.id),
  })
}

/** Pure function (easy to test): returns a new board with the card moved to the top of `stage`. */
export function moveCard(board: Board, dealId: number, stage: Stage): Board {
  const next = Object.fromEntries(Object.entries(board).map(([s, cards]) => [s, [...cards]])) as Board
  for (const cards of Object.values(next)) {
    const index = cards.findIndex((card) => card.id === dealId)
    if (index !== -1) {
      const [card] = cards.splice(index, 1)
      next[stage] = [{ ...card, stage }, ...next[stage]]
      break
    }
  }
  return next
}

export function useSaveDeal() {
  const invalidate = useInvalidateDeals()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Deal> & { id?: number }) =>
      id
        ? api<Deal>(`/api/deals/${id}/`, { method: 'PATCH', body })
        : api<Deal>('/api/deals/', { method: 'POST', body }),
    onSuccess: (deal) => invalidate(deal.id),
  })
}

export function useDealAction() {
  const invalidate = useInvalidateDeals()
  return useMutation({
    mutationFn: ({ id, action, body }: { id: number; action: 'move' | 'reassign'; body: object }) =>
      api<Deal>(`/api/deals/${id}/${action}/`, { method: 'POST', body }),
    onSuccess: (deal) => invalidate(deal.id),
  })
}

export function useDeleteDeal() {
  const invalidate = useInvalidateDeals()
  return useMutation({
    mutationFn: (id: number) => api<void>(`/api/deals/${id}/`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  })
}

export function useAddNote(dealId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => api<Activity>(`/api/deals/${dealId}/activities/`, { method: 'POST', body: { text } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.activities(dealId) }),
  })
}

function useCrud<T extends { id: number }>(resource: 'clients' | 'properties' | 'tasks') {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDeals()
  const done = () => {
    queryClient.invalidateQueries({ queryKey: [resource] })
    invalidate()
  }
  const save = useMutation({
    mutationFn: ({ id, ...body }: Partial<T> & { id?: number }) =>
      id
        ? api<T>(`/api/${resource}/${id}/`, { method: 'PATCH', body })
        : api<T>(`/api/${resource}/`, { method: 'POST', body }),
    onSuccess: done,
  })
  const remove = useMutation({
    mutationFn: (id: number) => api<void>(`/api/${resource}/${id}/`, { method: 'DELETE' }),
    onSuccess: done,
  })
  return { save, remove }
}

export const useClientCrud = () => useCrud<Client>('clients')
export const usePropertyCrud = () => useCrud<Property>('properties')
export const useTaskCrud = () => useCrud<Task>('tasks')

export function useToggleTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateDeals()
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      api<Task>(`/api/tasks/${id}/${done ? 'complete' : 'reopen'}/`, { method: 'POST' }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      invalidate(task.deal ?? undefined)
    },
  })
}
