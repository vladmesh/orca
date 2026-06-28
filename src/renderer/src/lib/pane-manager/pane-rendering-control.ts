import type { ManagedPaneInternal } from './pane-manager-types'
import { safeFit } from './pane-tree-ops'
import {
  attachWebgl,
  disposeWebgl,
  markComplexScriptOutput,
  resetWebglTextureAtlas,
  shouldUseTerminalWebgl
} from './pane-webgl-renderer'
import { reattachWebglIfNeeded } from './pane-webgl-reattach'

export function setPaneGpuRenderingState(
  panes: Map<number, ManagedPaneInternal>,
  paneId: number,
  enabled: boolean
): void {
  const pane = panes.get(paneId)
  if (!pane) {
    return
  }
  pane.gpuRenderingEnabled = enabled
  if (!enabled) {
    disposeWebgl(pane, { refreshDimensions: true })
    return
  }
  if (pane.webglAttachmentDeferred || pane.webglDisabledAfterContextLoss) {
    return
  }
  if (!pane.webglAddon) {
    attachWebgl(pane)
    safeFit(pane)
  }
}

export function setPaneTerminalTransparency(
  panes: Map<number, ManagedPaneInternal>,
  paneId: number,
  enabled: boolean
): void {
  const pane = panes.get(paneId)
  if (!pane || pane.terminalTransparencyEnabled === enabled) {
    return
  }
  // Why: xterm's WebGL renderer flickers under background transparency (#6491),
  // so DOM rendering is the only correct path when opacity < 1. Flip the
  // renderer the moment transparency toggles, reusing the same attach/dispose
  // guards as setPaneGpuRenderingState so the conditions stay in sync.
  pane.terminalTransparencyEnabled = enabled
  if (!shouldUseTerminalWebgl(pane)) {
    disposeWebgl(pane, { refreshDimensions: true })
    return
  }
  if (
    pane.gpuRenderingEnabled &&
    !pane.webglAddon &&
    !pane.webglAttachmentDeferred &&
    !pane.webglDisabledAfterContextLoss
  ) {
    attachWebgl(pane)
    safeFit(pane)
  }
}

export function markPaneComplexScriptOutput(
  panes: Map<number, ManagedPaneInternal>,
  paneId: number
): void {
  const pane = panes.get(paneId)
  if (pane) {
    markComplexScriptOutput(pane)
  }
}

export function suspendPaneRendering(panes: Iterable<ManagedPaneInternal>): void {
  for (const pane of panes) {
    pane.webglAttachmentDeferred = true
    disposeWebgl(pane)
  }
}

export function resumePaneRendering(panes: Iterable<ManagedPaneInternal>): void {
  for (const pane of panes) {
    pane.webglAttachmentDeferred = false
    reattachWebglIfNeeded(pane)
  }
}

export function resetPaneWebglTextureAtlases(panes: Iterable<ManagedPaneInternal>): void {
  for (const pane of panes) {
    resetWebglTextureAtlas(pane)
  }
}
