import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { isEphemeralSetupTerminalWorktreeId } from '../../../shared/ephemeral-setup-terminal-worktree-id'

const RUNTIME_WORKTREE_ID_SELECTOR_PREFIX = 'id:'

export function toRuntimeWorktreeSelector(worktreeId: string): string {
  const trimmed = worktreeId.trim()
  if (!trimmed || trimmed.startsWith(RUNTIME_WORKTREE_ID_SELECTOR_PREFIX)) {
    return trimmed
  }
  return `${RUNTIME_WORKTREE_ID_SELECTOR_PREFIX}${trimmed}`
}

// Why: ephemeral setup terminals have no worktree on the runtime. Scope them to
// the floating-terminal home dir so a remote runtime can resolve the selector.
export function toRuntimeTerminalWorktreeSelector(worktreeId: string): string {
  if (isEphemeralSetupTerminalWorktreeId(worktreeId.trim())) {
    return toRuntimeWorktreeSelector(FLOATING_TERMINAL_WORKTREE_ID)
  }
  return toRuntimeWorktreeSelector(worktreeId)
}
