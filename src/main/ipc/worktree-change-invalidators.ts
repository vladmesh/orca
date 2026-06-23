const worktreeChangeInvalidators = new Set<(repoId: string) => void>()

export function registerWorktreeChangeInvalidator(
  invalidator: (repoId: string) => void
): () => void {
  worktreeChangeInvalidators.add(invalidator)
  return () => {
    worktreeChangeInvalidators.delete(invalidator)
  }
}

export function runWorktreeChangeInvalidators(repoId: string): void {
  for (const invalidator of worktreeChangeInvalidators) {
    invalidator(repoId)
  }
}

export function __resetWorktreeChangeInvalidatorsForTests(): void {
  worktreeChangeInvalidators.clear()
}
