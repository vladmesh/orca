// Inline setup/onboarding terminals have no backing worktree. Branding their
// per-panel id lets the terminal RPC layer scope them to the floating terminal,
// instead of leaking an unresolvable selector to a remote runtime (#6789).
export const EPHEMERAL_SETUP_TERMINAL_WORKTREE_ID_PREFIX = 'ephemeral-setup-terminal:'

export function brandEphemeralSetupTerminalWorktreeId(panelId: string): string {
  return isEphemeralSetupTerminalWorktreeId(panelId)
    ? panelId
    : `${EPHEMERAL_SETUP_TERMINAL_WORKTREE_ID_PREFIX}${panelId}`
}

export function isEphemeralSetupTerminalWorktreeId(worktreeId: string): boolean {
  return worktreeId.startsWith(EPHEMERAL_SETUP_TERMINAL_WORKTREE_ID_PREFIX)
}
