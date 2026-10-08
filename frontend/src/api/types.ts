// Types that mirror the Django REST API responses.

export type Role = 'manager' | 'head'
export type DealType = 'sale' | 'rent'
export type Stage = 'new' | 'contacted' | 'viewing' | 'negotiation' | 'contract' | 'won' | 'lost'
export type PropertyKind = 'apartment' | 'house' | 'commercial' | 'land'
export type PropertyStatus = 'available' | 'reserved' | 'sold' | 'rented'
export type District = 'esil' | 'almaty' | 'saryarka' | 'baikonyr' | 'nura'
export type ClientKind = 'person' | 'company'
export type ClientSource = 'website' | 'krisha' | 'referral' | 'call' | 'social' | 'other'
export type ActivityKind = 'note' | 'created' | 'stage' | 'owner' | 'task_done'

export const STAGES: Stage[] = ['new', 'contacted', 'viewing', 'negotiation', 'contract', 'won', 'lost']
export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'viewing', 'negotiation', 'contract']
export const DISTRICTS: District[] = ['esil', 'almaty', 'saryarka', 'baikonyr', 'nura']
export const PROPERTY_KINDS: PropertyKind[] = ['apartment', 'house', 'commercial', 'land']
export const PROPERTY_STATUSES: PropertyStatus[] = ['available', 'reserved', 'sold', 'rented']
export const CLIENT_SOURCES: ClientSource[] = ['website', 'krisha', 'referral', 'call', 'social', 'other']

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface User {
  id: number
  username: string
  first_name: string
  last_name: string
  display_name: string
  role: Role
  is_head: boolean
  demo_mode: boolean
}

export interface UserShort {
  id: number
  display_name: string
  role: Role
}

export interface DemoAccount {
  username: string
  role: Role
  password: string
}

export interface Client {
  id: number
  name: string
  kind: ClientKind
  company_name: string
  phone: string
  email: string
  source: ClientSource
  notes: string
  owner: number
  owner_info: UserShort
  deals_count: number
  created_at: string
}

export interface ClientShort {
  id: number
  name: string
  phone: string
  kind: ClientKind
}

export interface Property {
  id: number
  title: string
  kind: PropertyKind
  deal_type: DealType
  district: District
  address: string
  rooms: number | null
  area: string
  floor: number | null
  price: number
  status: PropertyStatus
  description: string
  agent: number
  agent_info: UserShort
  can_edit: boolean
  created_at: string
}

export interface PropertyShort {
  id: number
  title: string
  kind: PropertyKind
  deal_type: DealType
  district: District
  price: number
  status: PropertyStatus
}

export interface DealListItem {
  id: number
  title: string
  client: ClientShort
  property: PropertyShort | null
  deal_type: DealType
  stage: Stage
  amount: number
  commission: number
  owner: UserShort
  expected_close_date: string | null
  open_tasks: number
  updated_at: string
}

export interface Deal {
  id: number
  title: string
  client: number
  client_info: ClientShort
  property: number | null
  property_info: PropertyShort | null
  deal_type: DealType
  stage: Stage
  amount: number
  commission_percent: string
  commission: number
  owner: number
  owner_info: UserShort
  lost_reason: string
  expected_close_date: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type Board = Record<Stage, DealListItem[]>

export interface Task {
  id: number
  title: string
  deal: number | null
  deal_title: string | null
  assignee: number
  assignee_info: UserShort
  due_at: string
  is_done: boolean
  is_overdue: boolean
  completed_at: string | null
  created_at: string
}

export interface Activity {
  id: number
  kind: ActivityKind
  text: string
  data: { from?: string; to?: string }
  author: UserShort | null
  created_at: string
}

export interface Money {
  count: number
  amount: number
  commission: number
}

export interface Dashboard {
  pipeline: Money
  won_this_month: Money
  conversion_rate: number | null
  avg_days_to_close: number | null
  by_stage: { stage: Stage; count: number; amount: number }[]
  monthly: { month: string; won_count: number; amount: number; commission: number }[]
  lost_reasons: { reason: string; count: number }[]
  tasks: { overdue: number; today: number }
  leaderboard:
    | { id: number; name: string; won_count: number; won_amount: number; commission: number; active_deals: number }[]
    | null
}
