import { useCallback, useRef, type ClipboardEvent } from 'react'
import { translate } from '@/i18n/i18n'
import type { AgentType } from '../../../../shared/agent-status-types'
import { resolveImagePaste } from './native-chat-image-paste'
import { NATIVE_CHAT_CONTEXT_PASTE_MAX_BYTES } from './native-chat-composer-target'

export type UseNativeChatComposerPasteArgs = {
  agent: AgentType
  /** Live composer-disabled state (no pty / presence-lock); read at await-resume
   *  via a ref so a flip mid-paste doesn't write into a guarded composer. */
  disabled: boolean
  caret: number
  attachLocalPaths: (paths: string[]) => void
  insertTypedText: (text: string) => boolean
  setCaret: (caret: number) => void
  setNotice: (notice: string | null) => void
}

/**
 * Clipboard-paste behavior for the native chat composer: a clipboard image
 * becomes an attachment (TUI parity), otherwise text is inserted at the caret.
 * `handlePaste` is the textarea's onPaste; `pasteFromClipboard` is the
 * pane-level Cmd/Ctrl+V path used when the pane (not the field) holds focus.
 */
export function useNativeChatComposerPaste({
  agent,
  disabled,
  caret,
  attachLocalPaths,
  insertTypedText,
  setCaret,
  setNotice
}: UseNativeChatComposerPasteArgs): {
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  pasteFromClipboard: () => void
} {
  // Re-read the live disabled state after the async clipboard round-trip:
  // `canSend` can flip (mobile presence-lock) or the pty drop out mid-await, and
  // the captured closure would otherwise attach/insert into a guarded composer.
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const attachClipboardImageTempFile = useCallback(
    (tempPath: string) => {
      const result = resolveImagePaste(agent, tempPath)
      if (result.kind === 'unsupported') {
        setNotice(
          translate(
            'components.native-chat.composer.imageUnsupported',
            'Image paste is not supported for this agent.'
          )
        )
        return
      }
      attachLocalPaths([result.path])
      setNotice(null)
    },
    [agent, attachLocalPaths, setNotice]
  )

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const hasImage = Array.from(event.clipboardData.items).some((item) =>
        item.type.startsWith('image/')
      )
      if (!hasImage) {
        return
      }
      event.preventDefault()
      // Why: snapshot the caret before the async temp-file round-trip — `caret`
      // state can move (further typing/selection) while the await is in flight.
      const caretAtPaste = caret
      void (async () => {
        const tempPath = await window.api.ui.saveClipboardImageAsTempFile()
        if (!tempPath || disabledRef.current) {
          return
        }
        attachClipboardImageTempFile(tempPath)
        setCaret(caretAtPaste)
      })()
    },
    [attachClipboardImageTempFile, caret, setCaret]
  )

  const pasteFromClipboard = useCallback(() => {
    void (async () => {
      const tempPath = await window.api.ui.saveClipboardImageAsTempFile().catch(() => null)
      if (disabledRef.current) {
        return
      }
      if (tempPath) {
        attachClipboardImageTempFile(tempPath)
        return
      }
      const text = await window.api.ui
        .readClipboardText({ maxBytes: NATIVE_CHAT_CONTEXT_PASTE_MAX_BYTES })
        .catch(() => '')
      if (disabledRef.current) {
        return
      }
      if (text.length > 0) {
        insertTypedText(text)
      }
    })()
  }, [attachClipboardImageTempFile, insertTypedText])

  return { handlePaste, pasteFromClipboard }
}
