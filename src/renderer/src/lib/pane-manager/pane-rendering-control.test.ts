import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ManagedPaneInternal } from './pane-manager-types'

// Why: mock the WebGL attach/dispose so the transparency flip can be asserted
// without a real WebGL2 context (unavailable in jsdom). The real renderer
// gate (shouldUseTerminalWebgl) still decides which path runs.
const attachWebgl = vi.fn()
const disposeWebgl = vi.fn()
vi.mock('./pane-webgl-renderer', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, attachWebgl, disposeWebgl }
})
vi.mock('./pane-tree-ops', () => ({ safeFit: vi.fn() }))

const { setPaneTerminalTransparency } = await import('./pane-rendering-control')

function createPane(
  overrides: Partial<
    Pick<ManagedPaneInternal, 'terminalTransparencyEnabled' | 'gpuRenderingEnabled'>
  > & { webglAddon?: ManagedPaneInternal['webglAddon'] } = {}
): ManagedPaneInternal {
  const leafId = '11111111-1111-4111-8111-111111111111' as never
  return {
    id: 1,
    leafId,
    stablePaneId: leafId,
    terminal: { cols: 80, rows: 24 } as never,
    container: {} as never,
    xtermContainer: {} as never,
    linkTooltip: {} as never,
    terminalGpuAcceleration: 'on',
    gpuRenderingEnabled: overrides.gpuRenderingEnabled ?? true,
    terminalTransparencyEnabled: overrides.terminalTransparencyEnabled ?? false,
    webglAttachmentDeferred: false,
    webglDisabledAfterContextLoss: false,
    hasComplexScriptOutput: false,
    webglAddon: overrides.webglAddon ?? null,
    ligaturesAddon: null,
    fitResizeObserver: null,
    pendingObservedFitRafId: null,
    fitAddon: {} as never,
    searchAddon: {} as never,
    serializeAddon: {} as never,
    unicode11Addon: {} as never,
    webLinksAddon: {} as never,
    compositionHandler: null,
    pendingSplitScrollState: null,
    debugLabel: null
  }
}

describe('setPaneTerminalTransparency', () => {
  beforeEach(() => {
    attachWebgl.mockReset()
    disposeWebgl.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tears down WebGL and switches to DOM when transparency is enabled', () => {
    const pane = createPane({ terminalTransparencyEnabled: false, webglAddon: {} as never })
    const panes = new Map([[1, pane]])

    setPaneTerminalTransparency(panes, 1, true)

    expect(pane.terminalTransparencyEnabled).toBe(true)
    expect(disposeWebgl).toHaveBeenCalledTimes(1)
    expect(attachWebgl).not.toHaveBeenCalled()
  })

  it('re-attaches WebGL when transparency is disabled and GPU is on', () => {
    vi.stubGlobal('navigator', {
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)'
    })
    const pane = createPane({ terminalTransparencyEnabled: true, webglAddon: null })
    const panes = new Map([[1, pane]])

    setPaneTerminalTransparency(panes, 1, false)

    expect(pane.terminalTransparencyEnabled).toBe(false)
    expect(attachWebgl).toHaveBeenCalledTimes(1)
    expect(disposeWebgl).not.toHaveBeenCalled()
  })

  it('is a no-op when the transparency flag already matches', () => {
    const pane = createPane({ terminalTransparencyEnabled: true })
    const panes = new Map([[1, pane]])

    setPaneTerminalTransparency(panes, 1, true)

    expect(attachWebgl).not.toHaveBeenCalled()
    expect(disposeWebgl).not.toHaveBeenCalled()
  })
})
