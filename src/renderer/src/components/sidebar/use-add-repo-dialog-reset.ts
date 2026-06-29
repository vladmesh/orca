import { useCallback } from 'react'
import type { AddRepoDialogStep } from './add-repo-dialog-types'

/**
 * Orchestrates resetting the Add Project dialog's per-flow state. `resetState`
 * runs on close/back; `resetHostScopedState` runs when the selected host changes
 * (it keeps the step and nested-review state so a host switch doesn't drop them).
 */
export function useAddRepoDialogReset({
  setStep,
  setIsAdding,
  setAddProjectBusyLabel,
  resetLocalFolderFlow,
  resetServerPathFlow,
  resetCloneFlow,
  resetNestedImportFlow,
  resetNestedRepoReviewState,
  resetCreateDefaultState,
  resetCreateState,
  resetRemoteState
}: {
  setStep: (step: AddRepoDialogStep) => void
  setIsAdding: (isAdding: boolean) => void
  setAddProjectBusyLabel: (label: string | null) => void
  resetLocalFolderFlow: () => void
  resetServerPathFlow: () => void
  resetCloneFlow: () => void
  resetNestedImportFlow: () => void
  resetNestedRepoReviewState: () => void
  resetCreateDefaultState: () => void
  resetCreateState: () => void
  resetRemoteState: () => void
}): { resetState: () => void; resetHostScopedState: () => void } {
  const resetState = useCallback(() => {
    // Why: kill the git clone process if one is running, so backing out
    // or closing the dialog doesn't leave a clone running on disk.
    void window.api.repos.cloneAbort()
    resetLocalFolderFlow()
    setStep('add')
    setIsAdding(false)
    setAddProjectBusyLabel(null)
    resetServerPathFlow()
    resetCloneFlow()
    resetNestedImportFlow()
    resetNestedRepoReviewState()
    resetCreateDefaultState()
    resetCreateState()
    resetRemoteState()
  }, [
    resetCloneFlow,
    resetLocalFolderFlow,
    resetNestedRepoReviewState,
    resetCreateDefaultState,
    resetServerPathFlow,
    resetNestedImportFlow,
    resetRemoteState,
    resetCreateState,
    setAddProjectBusyLabel,
    setIsAdding,
    setStep
  ])

  const resetHostScopedState = useCallback(() => {
    setIsAdding(false)
    setAddProjectBusyLabel(null)
    resetServerPathFlow()
    resetCloneFlow()
    resetCreateDefaultState()
    resetCreateState()
    resetRemoteState()
  }, [
    resetCloneFlow,
    resetCreateDefaultState,
    resetCreateState,
    resetRemoteState,
    resetServerPathFlow,
    setAddProjectBusyLabel,
    setIsAdding
  ])

  return { resetState, resetHostScopedState }
}
