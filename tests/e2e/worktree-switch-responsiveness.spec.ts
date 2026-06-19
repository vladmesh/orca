import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  ensureTerminalVisible,
  switchToWorktree,
  waitForActiveWorktree,
  waitForSessionReady
} from './helpers/store'
import { worktreeRow } from './worktree-row-locators'

const MAX_CLICK_TASK_DURATION_MS = 32
const MAX_CLICK_BACK_TIMER_DRIFT_MS = 32
const MIN_SETTLED_TERMINAL_COLS = 60

type ActiveTerminalGeometry = {
  cols: number
  rows: number
  proposedCols: number | null
}

async function prepareSidebarForSwitchTest(page: Page): Promise<[string, string]> {
  return page.evaluate(async () => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }

    const state = store.getState()
    state.setActiveView('terminal')
    state.setSidebarOpen(true)
    state.setGroupBy('none')
    state.setSortBy('recent')
    state.setShowActiveOnly(false)
    state.setShowSleepingWorkspaces(true)
    state.setHideDefaultBranchWorkspace(false)
    state.setFilterRepoIds([])

    const repo = state.repos[0]
    const worktrees = repo ? (state.worktreesByRepo[repo.id] ?? []) : []
    if (worktrees.length < 2) {
      throw new Error('Worktree switch responsiveness test needs at least two worktrees')
    }

    const [first, second] = worktrees
    if ((state.tabsByWorktree[second.id] ?? []).length === 0) {
      state.createTab(second.id, undefined, undefined, { pendingActivationSpawn: true })
    }
    state.revealWorktreeInSidebar(first.id, { behavior: 'auto' })
    state.revealWorktreeInSidebar(second.id, { behavior: 'auto' })
    state.setActiveWorktree(first.id)
    return [first.id, second.id]
  })
}

async function getActiveTerminalGeometry(page: Page): Promise<ActiveTerminalGeometry> {
  return page.evaluate(() => {
    const visibleOverlayTabId = (() => {
      for (const overlay of document.querySelectorAll<HTMLElement>(
        '[data-terminal-overlay-tab-id]'
      )) {
        const rect = overlay.getBoundingClientRect()
        if (
          overlay.dataset.terminalOverlayTabId &&
          getComputedStyle(overlay).display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0
        ) {
          return overlay.dataset.terminalOverlayTabId
        }
      }
      return null
    })()
    const state = window.__store?.getState()
    const worktreeId = state?.activeWorktreeId
    const storeTabId =
      state?.activeTabType === 'terminal'
        ? state.activeTabId
        : worktreeId
          ? (state?.activeTabIdByWorktree?.[worktreeId] ?? null)
          : null
    const tabId = visibleOverlayTabId ?? storeTabId
    const manager = tabId ? window.__paneManagers?.get(tabId) : null
    const pane = manager?.getActivePane?.() ?? manager?.getPanes?.()[0] ?? null
    if (!pane) {
      throw new Error('No active terminal pane is available')
    }
    const proposed = pane.fitAddon.proposeDimensions()
    return {
      cols: pane.terminal.cols,
      rows: pane.terminal.rows,
      proposedCols: proposed?.cols ?? null
    }
  })
}

async function waitForRenderedWorktree(page: Page, worktreeId: string): Promise<void> {
  await expect(page.locator('[data-rendered-active-worktree-id]')).toHaveAttribute(
    'data-rendered-active-worktree-id',
    worktreeId,
    { timeout: 10_000 }
  )
}

test.describe('Worktree switch responsiveness', () => {
  test.beforeEach(async ({ orcaPage }) => {
    await waitForSessionReady(orcaPage)
    await waitForActiveWorktree(orcaPage)
  })

  test('updates the selected workspace in the same click task when changing back', async ({
    orcaPage
  }) => {
    const [firstWorktreeId, secondWorktreeId] = await prepareSidebarForSwitchTest(orcaPage)
    const firstRow = worktreeRow(orcaPage, firstWorktreeId)
    const secondRow = worktreeRow(orcaPage, secondWorktreeId)

    await expect(firstRow).toBeVisible()
    await expect(secondRow).toBeVisible()
    await expect(firstRow).toHaveAttribute('aria-current', 'page')
    await expect(orcaPage.locator('[data-rendered-active-worktree-id]')).toHaveAttribute(
      'data-rendered-active-worktree-id',
      firstWorktreeId
    )

    const result = await orcaPage.evaluate(
      async ({ firstId, secondId, timerDelayMs }) => {
        const option = (id: string): HTMLElement => {
          const element = [...document.querySelectorAll<HTMLElement>('[data-worktree-id]')].find(
            (candidate) => candidate.dataset.worktreeId === id
          )
          if (!element) {
            throw new Error(`Missing worktree option for ${id}`)
          }
          return element
        }
        const surface = (id: string): HTMLElement => {
          const element = option(id).querySelector<HTMLElement>('[data-worktree-card-surface]')
          if (!element) {
            throw new Error(`Missing worktree card surface for ${id}`)
          }
          return element
        }
        const visibleState = () => ({
          firstCurrent: option(firstId).getAttribute('aria-current'),
          secondCurrent: option(secondId).getAttribute('aria-current'),
          renderedWorktreeId:
            document
              .querySelector('[data-rendered-active-worktree-id]')
              ?.getAttribute('data-rendered-active-worktree-id') ?? null
        })

        const before = visibleState()
        const firstClickStart = performance.now()
        surface(secondId).click()
        const afterFirstClick = {
          clickDurationMs: performance.now() - firstClickStart,
          ...visibleState()
        }

        const timerStart = performance.now()
        const afterSecondClick = await new Promise<
          ReturnType<typeof visibleState> & {
            clickDurationMs: number
            timerDriftMs: number
          }
        >((resolve) => {
          window.setTimeout(() => {
            const firedAt = performance.now()
            const secondClickStart = performance.now()
            surface(firstId).click()
            resolve({
              clickDurationMs: performance.now() - secondClickStart,
              timerDriftMs: firedAt - timerStart - timerDelayMs,
              ...visibleState()
            })
          }, timerDelayMs)
        })

        await new Promise((resolve) => window.setTimeout(resolve, 700))
        const afterQuietWindow = visibleState()

        return {
          before,
          afterFirstClick,
          afterSecondClick,
          afterQuietWindow
        }
      },
      { firstId: firstWorktreeId, secondId: secondWorktreeId, timerDelayMs: 120 }
    )

    expect(result.before).toMatchObject({
      firstCurrent: 'page',
      secondCurrent: null,
      renderedWorktreeId: firstWorktreeId
    })
    expect(result.afterFirstClick).toMatchObject({
      firstCurrent: null,
      secondCurrent: 'page',
      renderedWorktreeId: firstWorktreeId
    })
    expect(result.afterFirstClick.clickDurationMs).toBeLessThanOrEqual(MAX_CLICK_TASK_DURATION_MS)
    expect(result.afterSecondClick.timerDriftMs).toBeLessThanOrEqual(MAX_CLICK_BACK_TIMER_DRIFT_MS)
    expect(result.afterSecondClick.clickDurationMs).toBeLessThanOrEqual(MAX_CLICK_TASK_DURATION_MS)
    expect(result.afterSecondClick).toMatchObject({
      firstCurrent: 'page',
      secondCurrent: null
    })
    // Why: sidebar selection commits synchronously; the terminal surface may
    // still finish the prior switch until the quiet-window check below.
    expect(result.afterQuietWindow).toMatchObject({
      firstCurrent: 'page',
      secondCurrent: null,
      renderedWorktreeId: firstWorktreeId
    })
  })

  test('settles terminal geometry after switching back to a worktree', async ({ orcaPage }) => {
    const [firstWorktreeId, secondWorktreeId] = await prepareSidebarForSwitchTest(orcaPage)
    await ensureTerminalVisible(orcaPage)
    await waitForRenderedWorktree(orcaPage, firstWorktreeId)
    await expect(orcaPage.locator('.xterm').first()).toBeVisible()

    const initialGeometry = await getActiveTerminalGeometry(orcaPage)
    expect(initialGeometry.cols).toBeGreaterThan(MIN_SETTLED_TERMINAL_COLS)
    expect(initialGeometry.proposedCols).toBeGreaterThan(MIN_SETTLED_TERMINAL_COLS)

    await switchToWorktree(orcaPage, secondWorktreeId)
    await ensureTerminalVisible(orcaPage)
    await waitForRenderedWorktree(orcaPage, secondWorktreeId)
    await switchToWorktree(orcaPage, firstWorktreeId)
    await ensureTerminalVisible(orcaPage)
    await waitForRenderedWorktree(orcaPage, firstWorktreeId)

    await expect
      .poll(
        async () => {
          const geometry = await getActiveTerminalGeometry(orcaPage)
          return geometry.proposedCols === null
            ? geometry.cols
            : Math.abs(geometry.cols - geometry.proposedCols)
        },
        {
          timeout: 5_000,
          message: 'terminal columns did not settle back to the measured container width'
        }
      )
      .toBeLessThanOrEqual(1)

    const finalGeometry = await getActiveTerminalGeometry(orcaPage)
    expect(finalGeometry.cols).toBeGreaterThan(MIN_SETTLED_TERMINAL_COLS)
  })
})
