// Why: a fit-override event names a PTY, but pane IDs are per-tab and the
// override stream reaches every subscriber (including passive desktop
// watchers). This resolves which of this tab's panes are bound to the
// event's PTY via the tab's live transport bindings, so both the
// mobile-fit and desktop-fit branches of the override listener refit the
// same set of panes without colliding on global numeric pane IDs.

import type { ManagedPane } from '@/lib/pane-manager/pane-manager-types'

// Why: transports return string | null and the binding lookup yields
// undefined for unbound panes, so the resolver tolerates both absent cases.
export type PanePtyResolver = (paneId: number) => string | null | undefined

export function getOverrideAffectedPanes(
  panes: readonly ManagedPane[],
  resolvePtyId: PanePtyResolver,
  ptyId: string
): ManagedPane[] {
  return panes.filter((pane) => resolvePtyId(pane.id) === ptyId)
}
