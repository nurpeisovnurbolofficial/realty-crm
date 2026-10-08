import { describe, expect, it } from 'vitest'

import { moveCard } from './hooks'
import type { Board, DealListItem, Stage } from './types'

function card(id: number, stage: Stage): DealListItem {
  return {
    id,
    title: `Deal ${id}`,
    client: { id: 1, name: 'Client', phone: '', kind: 'person' },
    property: null,
    deal_type: 'sale',
    stage,
    amount: 1000,
    commission: 30,
    owner: { id: 1, display_name: 'Daniyar', role: 'manager' },
    expected_close_date: null,
    open_tasks: 0,
    updated_at: '',
  }
}

const emptyBoard = (): Board => ({
  new: [],
  contacted: [],
  viewing: [],
  negotiation: [],
  contract: [],
  won: [],
  lost: [],
})

describe('moveCard (optimistic update of the Kanban board)', () => {
  it('moves the card to the top of the target column and updates its stage', () => {
    const board = { ...emptyBoard(), new: [card(1, 'new'), card(2, 'new')], viewing: [card(3, 'viewing')] }
    const next = moveCard(board, 2, 'viewing')
    expect(next.new.map((c) => c.id)).toEqual([1])
    expect(next.viewing.map((c) => c.id)).toEqual([2, 3])
    expect(next.viewing[0].stage).toBe('viewing')
  })

  it('does not mutate the original board (needed for rollback)', () => {
    const board = { ...emptyBoard(), new: [card(1, 'new')] }
    moveCard(board, 1, 'won')
    expect(board.new).toHaveLength(1)
    expect(board.won).toHaveLength(0)
  })
})
