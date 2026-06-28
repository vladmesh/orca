import type { MobileGitStagingArea } from './mobile-git-status'

export type MobileReviewRouteArea = MobileGitStagingArea | 'branch'

export type MobileReviewRouteTarget = {
  hostId: string
  worktreeId: string
  worktreeName: string
  filePath: string
  area: MobileReviewRouteArea
}

export function buildMobileReviewFileRoute(target: MobileReviewRouteTarget): string {
  const params = new URLSearchParams()
  params.set('scope', 'all')
  params.set('file', target.filePath)
  params.set('area', target.area)
  if (target.worktreeName) {
    params.set('name', target.worktreeName)
  }
  return `/h/${encodeURIComponent(target.hostId)}/review/${encodeURIComponent(
    target.worktreeId
  )}?${params.toString()}`
}
