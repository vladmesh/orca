import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'vitest'
import {
  getContextualTour,
  type ContextualTourStepPlacement
} from '../../../../shared/contextual-tours'
import { getContextualTourOverlayPanelPosition } from './contextual-tour-overlay-position'
import {
  ContextualTourOverlaySurface,
  handleContextualTourOverlayKeyDown,
  type ActiveTourRenderState
} from './ContextualTourOverlaySurface'

const MENU_BUTTON_LEFT = 812
const MENU_DROPDOWN_WIDTH = 224
const MENU_DROPDOWN_LEFT = 844 - MENU_DROPDOWN_WIDTH
const MENU_DROPDOWN_TOP = 42

const browserTour = getContextualTour('browser')

const BROWSER_TOUR_STEPS = browserTour.steps.map((step, index) => {
  const targetRects = [
    { left: 612, top: 6, right: 644, bottom: 38, width: 32, height: 32 },
    { left: 652, top: 6, right: 684, bottom: 38, width: 32, height: 32 },
    { left: 624, top: 120, right: 840, bottom: 148, width: 216, height: 28 }
  ] as const

  return {
    title: step.title,
    body: step.body,
    targetSelector: step.targetSelector.match(/data-contextual-tour-target="([^"]+)"/)?.[1] ?? '',
    preferredPlacement: step.preferredPlacement as ContextualTourStepPlacement | undefined,
    openMenu: index === 2,
    targetRect: targetRects[index]!
  }
})

function renderBrowserTourOverlay(stepIndex: number): string {
  const step = BROWSER_TOUR_STEPS[stepIndex]
  const progress = { current: stepIndex + 1, total: BROWSER_TOUR_STEPS.length }
  const targetRect = step.targetRect as DOMRect
  const { panelPosition, panelPlacement } = getContextualTourOverlayPanelPosition({
    targetRect,
    panelElement: null,
    panelHost: null,
    preferredPlacement: 'preferredPlacement' in step ? step.preferredPlacement : undefined,
    viewport: { width: 1200, height: 800 }
  })

  const renderState: ActiveTourRenderState = {
    rect: targetRect,
    targetElement: { closest: () => null } as unknown as Element,
    progress,
    title: step.title,
    body: step.body,
    isLastStep: progress.current === progress.total,
    isFirstStep: progress.current === 1,
    panelHost: null,
    preferredPlacement: 'preferredPlacement' in step ? step.preferredPlacement : undefined
  }

  return renderToStaticMarkup(
    ContextualTourOverlaySurface({
      activeTourId: 'browser',
      renderState,
      panelRef: { current: null },
      panelPosition,
      panelPlacement,
      panelHost: null,
      onSkip: () => {},
      onBack: () => {},
      onNext: () => {},
      onStepAction: () => {},
      onOverlayKeyDownCapture: handleContextualTourOverlayKeyDown
    })
  )
}

describe('browser contextual tour mock generator', () => {
  it('writes the browser tour HTML mock', () => {
    const stepPanels = BROWSER_TOUR_STEPS.map((step, index) => ({
      step,
      index,
      overlayMarkup: renderBrowserTourOverlay(index)
    }))

    const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Browser contextual tour mock</title>
    <style>
      :root {
        --background: #0a0a0a;
        --foreground: #fafafa;
        --popover: #171717;
        --popover-foreground: #fafafa;
        --muted-foreground: #a1a1a1;
        --border: #ffffff1a;
        --ring: #737373;
        --primary: #e5e5e5;
        --primary-foreground: #171717;
        --accent: #404040;
        --radius: 0.625rem;
        --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: var(--font-sans);
        background: var(--background);
        color: var(--foreground);
      }

      .page { width: 1200px; margin: 0 auto; }

      .when-note {
        padding: 16px 16px 0;
        font-size: 12px;
        line-height: 1.55;
        color: var(--muted-foreground);
      }

      .when-note strong { color: var(--foreground); }
      .when-note ul { margin: 8px 0 0; padding-left: 18px; }
      .when-note li + li { margin-top: 4px; }

      .step-switcher {
        display: flex;
        gap: 8px;
        padding: 12px 16px 16px;
        flex-wrap: wrap;
      }

      .step-switcher button {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted-foreground);
        border-radius: 999px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
      }

      .step-switcher button.active {
        background: #262626;
        color: var(--foreground);
      }

      .browser-frame {
        position: relative;
        height: 720px;
        border-top: 1px solid var(--border);
        border-bottom: 1px solid var(--border);
        background: #111;
      }

      .browser-toolbar {
        position: relative;
        z-index: 10;
        height: 45px;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        background: color-mix(in srgb, var(--background) 95%, transparent);
      }

      .toolbar-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: calc(var(--radius) * 0.8);
        background: transparent;
        color: var(--muted-foreground);
        cursor: default;
      }

      .toolbar-btn.is-open {
        background: color-mix(in srgb, var(--foreground) 8%, transparent);
        color: var(--foreground);
      }

      .toolbar-btn.size-7 { width: 28px; height: 28px; }
      .toolbar-btn.size-8 { width: 32px; height: 32px; }
      .toolbar-btn svg { width: 16px; height: 16px; }

      .address-bar {
        position: absolute;
        top: 50%;
        left: 108px;
        right: 220px;
        transform: translateY(-50%);
        height: 30px;
        border: 1px solid var(--border);
        border-radius: calc(var(--radius) * 0.8);
        background: color-mix(in srgb, var(--foreground) 4%, transparent);
        color: var(--muted-foreground);
        font-size: 12px;
        padding: 0 10px;
        display: flex;
        align-items: center;
      }

      .browser-menu-dropdown {
        position: absolute;
        z-index: 20;
        top: ${MENU_DROPDOWN_TOP}px;
        left: ${MENU_DROPDOWN_LEFT}px;
        width: ${MENU_DROPDOWN_WIDTH}px;
        border: 1px solid color-mix(in srgb, white 14%, transparent);
        border-radius: 11px;
        background: rgba(0, 0, 0, 0.72);
        box-shadow:
          0 20px 44px rgba(0, 0, 0, 0.42),
          inset 0 1px 0 rgba(255, 255, 255, 0.04);
        backdrop-filter: blur(24px);
        padding: 4px;
        color: white;
      }

      .menu-item,
      .menu-subtrigger {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        border: none;
        border-radius: 7px;
        background: transparent;
        color: inherit;
        font-size: 12px;
        line-height: 20px;
        font-weight: 500;
        text-align: left;
        padding: 4px 8px;
        cursor: default;
      }

      .menu-item svg,
      .menu-subtrigger svg {
        width: 14px;
        height: 14px;
        color: var(--muted-foreground);
        flex-shrink: 0;
      }

      .menu-item .check { opacity: 0; }
      .menu-item .check.visible { opacity: 1; }
      .menu-item .meta {
        margin-left: auto;
        padding-left: 8px;
        font-size: 10px;
        color: var(--muted-foreground);
      }

      .menu-subtrigger.is-target,
      .menu-item.is-target {
        background: color-mix(in srgb, white 14%, transparent);
      }

      .menu-subtrigger .chevron {
        margin-left: auto;
        width: 14px;
        height: 14px;
        opacity: 0.55;
      }

      .menu-separator {
        height: 1px;
        background: color-mix(in srgb, var(--border) 70%, transparent);
        margin: 4px 0;
      }

      .browser-page {
        height: calc(100% - 45px);
        background: #141414;
      }

      .tour-layer { position: absolute; inset: 0; pointer-events: none; }
      .tour-layer > .pointer-events-auto { pointer-events: auto; }
      .hidden { display: none !important; }

      .orca-contextual-tour-panel {
        background: linear-gradient(
          180deg,
          color-mix(in srgb, var(--foreground) 4%, var(--popover)) 0%,
          var(--popover) 14%
        );
        box-shadow:
          inset 0 1px 0 0 color-mix(in srgb, var(--foreground) 5%, transparent),
          0 10px 24px rgba(0, 0, 0, 0.35);
      }

      .rounded-lg { border-radius: var(--radius); }
      .border { border-width: 1px; border-style: solid; }
      .border-border { border-color: var(--border); }
      .text-popover-foreground { color: var(--popover-foreground); }
      .backdrop-blur-\\[2px\\] { backdrop-filter: blur(2px); }
      .fixed { position: fixed; }
      .absolute { position: absolute; }
      .inset-0 { inset: 0; }
      .z-\\[70\\] { z-index: 70; }
      .pointer-events-none { pointer-events: none; }
      .pointer-events-auto { pointer-events: auto; }
      .w-\\[min\\(20rem\\,calc\\(100vw-1\\.5rem\\)\\)\\] { width: min(20rem, calc(100vw - 1.5rem)); }
      .p-4 { padding: 16px; }
      .pr-6 { padding-right: 24px; }
      .mt-1\\.5 { margin-top: 6px; }
      .mt-3\\.5 { margin-top: 14px; }
      .text-sm { font-size: 14px; line-height: 1.25rem; }
      .text-xs { font-size: 12px; line-height: 1rem; }
      .font-semibold { font-weight: 600; }
      .tracking-tight { letter-spacing: -0.025em; }
      .text-foreground { color: var(--foreground); }
      .text-muted-foreground { color: var(--muted-foreground); }
      .leading-5 { line-height: 1.25rem; }
      .flex { display: flex; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .gap-1\\.5 { gap: 6px; }
      .gap-2 { gap: 8px; }
      .gap-3 { gap: 12px; }
      .right-2 { right: 8px; }
      .top-2 { top: 8px; }
      .inline-flex { display: inline-flex; }
      .shrink-0 { flex-shrink: 0; }
      .whitespace-nowrap { white-space: nowrap; }
      .size-6 { width: 24px; height: 24px; }
      .rounded-md { border-radius: calc(var(--radius) * 0.8); }
      .h-6 { height: 24px; }
      .px-2 { padding-left: 8px; padding-right: 8px; }
      .bg-primary { background: var(--primary); }
      .text-primary-foreground { color: var(--primary-foreground); }
      button[data-slot='button'] { border: none; cursor: default; font: inherit; }
      button[data-variant='ghost'][data-size='icon-xs'] {
        width: 24px; height: 24px; display: inline-flex; align-items: center;
        justify-content: center; border-radius: calc(var(--radius) * 0.8);
        background: transparent; color: var(--muted-foreground);
      }
      button[data-variant='ghost'][data-size='xs'] {
        height: 24px; display: inline-flex; align-items: center; gap: 4px;
        border-radius: calc(var(--radius) * 0.8); padding: 0 8px;
        background: transparent; color: var(--muted-foreground);
        font-size: 12px; font-weight: 500;
      }
      button[data-variant='default'][data-size='xs'] {
        height: 24px; display: inline-flex; align-items: center; gap: 4px;
        border-radius: calc(var(--radius) * 0.8); padding: 0 8px;
        background: var(--primary); color: var(--primary-foreground);
        font-size: 12px; font-weight: 500;
      }
      .block { display: block; }
      .h-1\\.5 { height: 6px; }
      .w-1\\.5 { width: 6px; }
      .w-4 { width: 16px; }
      .rounded-full { border-radius: 9999px; }
      .bg-foreground { background: var(--foreground); }
      .bg-foreground\\/55 { background: color-mix(in srgb, var(--foreground) 55%, transparent); }
      .bg-foreground\\/20 { background: color-mix(in srgb, var(--foreground) 20%, transparent); }
      .text-\\[11px\\] { font-size: 11px; }
      .font-medium { font-weight: 500; }
      .leading-none { line-height: 1; }
      .fill-popover { fill: var(--popover); }
      .stroke-border { stroke: var(--border); }
      .overflow-visible { overflow: visible; }
      .lucide { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="browser-frame">
        <div class="browser-toolbar" data-contextual-tour-target="browser-toolbar">
          <button class="toolbar-btn size-7" type="button" aria-label="Back" style="left:12px">
            <svg viewBox="0 0 24 24" class="lucide"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button class="toolbar-btn size-7" type="button" aria-label="Forward" style="left:44px">
            <svg viewBox="0 0 24 24" class="lucide"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <button class="toolbar-btn size-7" type="button" aria-label="Reload" style="left:76px">
            <svg viewBox="0 0 24 24" class="lucide"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
          </button>
          <div class="address-bar">app.staging.example.com/dashboard</div>
          <button class="toolbar-btn size-8" type="button" aria-label="Grab page element" data-contextual-tour-target="browser-grab-control" style="left:${BROWSER_TOUR_STEPS[0].targetRect.left}px">
            <svg viewBox="0 0 24 24" class="lucide"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          </button>
          <button class="toolbar-btn size-8" type="button" aria-label="Annotate page element" data-contextual-tour-target="browser-annotation-control" style="left:${BROWSER_TOUR_STEPS[1].targetRect.left}px">
            <svg viewBox="0 0 24 24" class="lucide"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M12 7v6M9 10h6"/></svg>
          </button>
          <button class="toolbar-btn size-7" type="button" aria-label="Open browser devtools" style="left:692px">
            <svg viewBox="0 0 24 24" class="lucide"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
          </button>
          <button class="toolbar-btn size-7" type="button" aria-label="Open in default browser" style="left:728px">
            <svg viewBox="0 0 24 24" class="lucide"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          </button>
          <button class="toolbar-btn size-8 is-open" type="button" aria-label="Browser menu" data-contextual-tour-target="browser-menu-control" style="left:${MENU_BUTTON_LEFT}px" id="browser-menu-trigger">
            <svg viewBox="0 0 24 24" class="lucide"><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></svg>
          </button>
        </div>

        <div class="browser-menu-dropdown hidden" id="browser-menu-dropdown" data-step-menu="3">
          <button class="menu-item" type="button">
            <svg viewBox="0 0 24 24" class="lucide check visible"><path d="M20 6 9 17l-5-5"/></svg>
            Default
          </button>
          <div class="menu-separator"></div>
          <button class="menu-item" type="button">
            <svg viewBox="0 0 24 24" class="lucide"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            New Profile…
          </button>
          <div class="menu-separator"></div>
          <button
            class="menu-subtrigger is-target"
            type="button"
            data-contextual-tour-target="browser-import-cookies-control"
            id="browser-import-cookies-target"
          >
            <svg viewBox="0 0 24 24" class="lucide"><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M8 21h8"/></svg>
            Import Cookies
            <svg viewBox="0 0 24 24" class="lucide chevron"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <button class="menu-subtrigger" type="button">
            <svg viewBox="0 0 24 24" class="lucide"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
            Viewport Size
            <svg viewBox="0 0 24 24" class="lucide chevron"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div class="menu-separator"></div>
          <button class="menu-item" type="button">
            <svg viewBox="0 0 24 24" class="lucide"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Browser Settings…
          </button>
        </div>

        <div class="browser-page"></div>
        ${stepPanels
          .map(
            ({ overlayMarkup, index }) =>
              `<div class="tour-layer${index === 2 ? '' : ' hidden'}" data-tour-step="${index + 1}">${overlayMarkup}</div>`
          )
          .join('\n        ')}
      </div>

      <div class="when-note">
        <strong>When does this show?</strong>
        <ul>
          <li>First time a <strong>new user</strong> opens an in-app browser tab on a <strong>local desktop browser</strong> (not a remote/SSH runtime browser).</li>
          <li>Only once per profile, and only one contextual tour per session.</li>
          <li>Step 3 is the last step — it appears after Next on step 2. In production, advancing to step 3 would open the <strong>···</strong> menu automatically.</li>
        </ul>
        <p style="margin-top:10px">
          <strong>Step 3 points to:</strong> the <code>Import Cookies</code> row inside the open browser menu
          (<code>data-contextual-tour-target="browser-import-cookies-control"</code>), not the ··· button itself.
        </p>
      </div>

      <div class="step-switcher" aria-label="Preview tour steps">
        ${BROWSER_TOUR_STEPS.map(
          (step, index) =>
            `<button type="button" data-step="${index + 1}" class="${index === 2 ? 'active' : ''}">Step ${index + 1} — ${step.title}</button>`
        ).join('\n        ')}
      </div>
    </div>
    <script>
      const layers = [...document.querySelectorAll('[data-tour-step]')];
      const buttons = [...document.querySelectorAll('.step-switcher button')];
      const menu = document.getElementById('browser-menu-dropdown');
      const menuTrigger = document.getElementById('browser-menu-trigger');

      function showStep(step) {
        layers.forEach((layer) => {
          layer.classList.toggle('hidden', layer.dataset.tourStep !== String(step));
        });
        buttons.forEach((button) => {
          button.classList.toggle('active', button.dataset.step === String(step));
        });
        const showMenu = step === 3;
        menu.classList.toggle('hidden', !showMenu);
        menuTrigger.classList.toggle('is-open', showMenu);
      }

      buttons.forEach((button) => {
        button.addEventListener('click', () => showStep(Number(button.dataset.step)));
      });
      showStep(3);
    </script>
  </body>
</html>
`

    writeFileSync(resolve(process.cwd(), 'mock-browser-contextual-tour-step3.html'), html, 'utf8')
  })
})
