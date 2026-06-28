import { describe, expect, it } from 'vitest'
import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'
import { getOverrideAffectedPanes } from './override-affected-panes'

// Only `id` matters for resolution; cast the partial fixtures to ManagedPane.
function makePane(id: number): ManagedPane {
  return { id } as ManagedPane
}

describe('getOverrideAffectedPanes', () => {
  it('returns only panes bound to the event PTY in this tab', () => {
    const panes = [makePane(1), makePane(2), makePane(3)]
    const bindings = new Map<number, string>([
      [1, 'pty-a'],
      [2, 'pty-b'],
      [3, 'pty-a']
    ])

    const affected = getOverrideAffectedPanes(panes, (paneId) => bindings.get(paneId), 'pty-a')

    expect(affected.map((pane) => pane.id)).toEqual([1, 3])
  })

  it('returns nothing for a watcher whose panes are bound to other PTYs', () => {
    const panes = [makePane(10), makePane(11)]
    const bindings = new Map<number, string>([
      [10, 'pty-x'],
      [11, 'pty-y']
    ])

    const affected = getOverrideAffectedPanes(panes, (paneId) => bindings.get(paneId), 'pty-z')

    expect(affected).toEqual([])
  })

  it('ignores unbound panes (resolver returns undefined)', () => {
    const panes = [makePane(1), makePane(2)]
    const bindings = new Map<number, string>([[1, 'pty-a']])

    const affected = getOverrideAffectedPanes(panes, (paneId) => bindings.get(paneId), 'pty-a')

    expect(affected.map((pane) => pane.id)).toEqual([1])
  })
})
