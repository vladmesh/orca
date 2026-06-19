import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import { fitPanes } from './pane-helpers'

const VISIBLE_RESUME_SETTLED_REFIT_DELAYS_MS = [50, 150, 400] as const

type CurrentRef<T> = {
  current: T
}

export function scheduleVisibleResumeSettledRefits({
  manager,
  managerRef,
  isVisibleRef
}: {
  manager: PaneManager
  managerRef: CurrentRef<PaneManager | null>
  isVisibleRef: CurrentRef<boolean>
}): () => void {
  let cancelled = false
  const animationFrameIds: number[] = []
  const timerIds: number[] = []

  const fitIfStillVisible = (): void => {
    if (cancelled || !isVisibleRef.current || managerRef.current !== manager) {
      return
    }
    fitPanes(manager)
  }

  // Why: worktree reveal can briefly report the previous/hidden geometry.
  // Retry after paint and layout settle so xterm does not keep stale columns.
  if (typeof window.requestAnimationFrame === 'function') {
    animationFrameIds.push(window.requestAnimationFrame(fitIfStillVisible))
  }
  if (typeof window.setTimeout === 'function') {
    for (const delayMs of VISIBLE_RESUME_SETTLED_REFIT_DELAYS_MS) {
      timerIds.push(window.setTimeout(fitIfStillVisible, delayMs))
    }
  }

  return () => {
    cancelled = true
    if (typeof window.cancelAnimationFrame === 'function') {
      for (const animationFrameId of animationFrameIds) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
    if (typeof window.clearTimeout === 'function') {
      for (const timerId of timerIds) {
        window.clearTimeout(timerId)
      }
    }
  }
}
