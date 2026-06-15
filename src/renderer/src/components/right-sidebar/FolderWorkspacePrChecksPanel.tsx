import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { openHttpLink } from '@/lib/http-link-routing'
import { translate } from '@/i18n/i18n'
import { getAttachedWorktreesForFolderWorkspace } from './folder-workspace-attached-worktrees'
import { CHECK_COLOR, CHECK_ICON, prStateColor, PullRequestIcon } from './checks-panel-content'
import {
  buildParentPrChecksProjection,
  type ParentPrChecksRefreshOutcome,
  type ParentPrChecksRow
} from './parent-pr-checks-rows'
import {
  getParentPrChecksRefreshCandidates,
  runLimitedParentPrChecksRefreshes
} from './parent-pr-checks-refresh'

type FolderWorkspacePrChecksPanelProps = {
  isVisible?: boolean
}

export default function FolderWorkspacePrChecksPanel({
  isVisible = true
}: FolderWorkspacePrChecksPanelProps): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorkspaceKey = useAppStore((s) => s.activeWorkspaceKey)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const workspaceLineageByChildKey = useAppStore((s) => s.workspaceLineageByChildKey)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const settings = useAppStore((s) => s.settings)
  const hostedReviewCache = useAppStore((s) => s.hostedReviewCache)
  const prCache = useAppStore((s) => s.prCache)
  const checksCache = useAppStore((s) => s.checksCache)
  const fetchHostedReviewForBranch = useAppStore((s) => s.fetchHostedReviewForBranch)
  const fetchPRChecks = useAppStore((s) => s.fetchPRChecks)
  const setActiveWorktree = useAppStore((s) => s.setActiveWorktree)
  const setRightSidebarTab = useAppStore((s) => s.setRightSidebarTab)
  const [refreshOutcomes, setRefreshOutcomes] = useState<
    ReadonlyMap<string, ParentPrChecksRefreshOutcome>
  >(() => new Map())
  const [manualRefreshGeneration, setManualRefreshGeneration] = useState(0)
  const lastForcedManualRefreshGenerationRef = useRef(0)

  const { folderWorkspace, childWorktrees } = useMemo(
    () =>
      getAttachedWorktreesForFolderWorkspace({
        activeWorkspaceKey,
        activeWorktreeId,
        folderWorkspaces,
        workspaceLineageByChildKey,
        worktreeLineageById,
        worktreesByRepo
      }),
    [
      activeWorkspaceKey,
      activeWorktreeId,
      folderWorkspaces,
      workspaceLineageByChildKey,
      worktreeLineageById,
      worktreesByRepo
    ]
  )
  const projection = useMemo(
    () =>
      buildParentPrChecksProjection({
        worktrees: childWorktrees,
        repos,
        settings,
        hostedReviewCache,
        prCache,
        checksCache,
        refreshOutcomes
      }),
    [childWorktrees, repos, settings, hostedReviewCache, prCache, checksCache, refreshOutcomes]
  )
  const candidateSignature = useMemo(
    () =>
      childWorktrees
        .map((worktree) =>
          [
            worktree.id,
            worktree.instanceId ?? '',
            worktree.repoId,
            worktree.branch,
            worktree.linkedPR ?? '',
            worktree.linkedGitLabMR ?? '',
            worktree.linkedBitbucketPR ?? '',
            worktree.linkedAzureDevOpsPR ?? '',
            worktree.linkedGiteaPR ?? ''
          ].join('|')
        )
        .join(';;'),
    [childWorktrees]
  )
  const refreshCandidates = useMemo(
    () => getParentPrChecksRefreshCandidates({ worktrees: childWorktrees, repos }),
    [childWorktrees, repos]
  )

  useEffect(() => {
    if (!isVisible || !folderWorkspace || childWorktrees.length === 0) {
      return
    }
    if (refreshCandidates.length === 0) {
      return
    }
    const forceRefresh = manualRefreshGeneration > lastForcedManualRefreshGenerationRef.current
    if (forceRefresh) {
      lastForcedManualRefreshGenerationRef.current = manualRefreshGeneration
    }
    let cancelled = false
    void runLimitedParentPrChecksRefreshes({
      candidates: refreshCandidates,
      concurrency: 3,
      force: forceRefresh,
      fetchHostedReviewForBranch,
      fetchPRChecks,
      onOutcome: (identity, outcome) => {
        if (cancelled) {
          return
        }
        setRefreshOutcomes((current) => new Map(current).set(identity, outcome))
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    isVisible,
    folderWorkspace,
    childWorktrees,
    refreshCandidates,
    fetchHostedReviewForBranch,
    fetchPRChecks,
    candidateSignature,
    manualRefreshGeneration
  ])

  const currentRefreshIdentities = useMemo(
    () => new Set(refreshCandidates.map((candidate) => candidate.identity)),
    [refreshCandidates]
  )
  const isRefreshing = [...refreshOutcomes.entries()].some(
    ([identity, outcome]) => currentRefreshIdentities.has(identity) && outcome.kind === 'loading'
  )

  const activateChecksRow = (row: ParentPrChecksRow): void => {
    setActiveWorktree(row.worktree.id)
    setRightSidebarTab('checks')
  }

  if (!folderWorkspace) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {translate(
          'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.unavailable',
          'PR checks are only shown for folder workspaces.'
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {folderWorkspace.name}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {formatSummary(projection.summary)}
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setManualRefreshGeneration((generation) => generation + 1)}
                disabled={childWorktrees.length === 0 || isRefreshing}
                aria-label={translate(
                  'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.refresh',
                  'Refresh PR checks'
                )}
              >
                <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {translate(
                'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.refresh',
                'Refresh PR checks'
              )}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {childWorktrees.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="text-sm font-medium text-foreground">
            {translate(
              'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.emptyTitle',
              'No attached worktrees yet'
            )}
          </div>
          <div className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">
            {translate(
              'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.emptyCopy',
              'PR checks will appear here after worktrees are attached to this folder workspace.'
            )}
          </div>
        </div>
      ) : (
        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <div className="space-y-3">
            {projection.groups.map((group) => (
              <section key={group.key}>
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.rows.map((row) => (
                    <PrChecksRow key={row.id} row={row} onActivate={() => activateChecksRow(row)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PrChecksRow({
  row,
  onActivate
}: {
  row: ParentPrChecksRow
  onActivate: () => void
}): React.JSX.Element {
  const Icon = CHECK_ICON[row.checkTone] ?? CHECK_ICON.neutral
  const reviewProviderLabel = row.provider === 'gitlab' ? 'MR' : 'PR'
  const openChecksLabel = translate(
    'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.openChecksTab',
    'Open {{value0}} Checks tab',
    { value0: row.worktree.displayName }
  )
  const openExternalLabel = translate(
    'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.openReviewExternally',
    'Open {{value0}} externally',
    { value0: reviewProviderLabel }
  )
  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.preventDefault()
        onActivate()
      }}
      aria-label={openChecksLabel}
    >
      <Icon className={cn('mt-0.5 size-3.5 shrink-0', CHECK_COLOR[row.checkTone])} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">
            {row.worktree.displayName}
          </span>
          {row.reviewLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              <PullRequestIcon className="size-3" />
              {row.reviewLabel}
            </span>
          ) : null}
          {row.reviewState ? (
            <span
              className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                prStateColor(row.reviewState)
              )}
            >
              {row.reviewState}
            </span>
          ) : null}
        </div>
        <div className="mt-1 truncate text-[12px] text-foreground/90">{row.title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{row.summary}</span>
          {row.repo ? <span className="shrink-0">· {row.repo.displayName}</span> : null}
          {row.branch ? <span className="truncate">· {row.branch}</span> : null}
        </div>
        {row.detailNames.length > 0 ? (
          <div className="mt-1 truncate text-[11px] text-muted-foreground">
            {row.detailNames.join(', ')}
          </div>
        ) : null}
      </div>
      {row.reviewUrl ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground opacity-80 hover:bg-accent hover:text-foreground group-hover:opacity-100"
              aria-label={openExternalLabel}
              onClick={(event) => {
                event.stopPropagation()
                void openHttpLink(row.reviewUrl!)
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <ExternalLink className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{openExternalLabel}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

function formatSummary(summary: {
  attached: number
  knownReview: number
  failing: number
  pending: number
  passing: number
  noPr: number
  unknown: number
}): string {
  return translate(
    'auto.components.rightSidebar.FolderWorkspacePrChecksPanel.summary',
    '{{value0}} attached · {{value1}} with PR/MR · {{value2}} attention · {{value3}} pending · {{value4}} passing · {{value5}} no PR · {{value6}} unknown',
    {
      value0: summary.attached,
      value1: summary.knownReview,
      value2: summary.failing,
      value3: summary.pending,
      value4: summary.passing,
      value5: summary.noPr,
      value6: summary.unknown
    }
  )
}
