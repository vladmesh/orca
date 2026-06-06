import { Loader2 } from 'lucide-react'

type StreamSize = {
  height: number
  width: number
}

type EmulatorScreenStreamContentProps = {
  loading: boolean
  onStreamError: () => void
  onStreamSize: (size: StreamSize) => void
  previewUrl?: string
  showStream: boolean
  streamError: boolean
  streamKey?: string
}

// Why: serve-sim exposes multipart/x-mixed-replace MJPEG at streamUrl; Chromium webviews
// render that as a blank document, but <img> displays the live frames correctly.
function simulatorMjpegSrc(previewUrl: string, streamKey?: string): string {
  const url = new URL(previewUrl)
  if (streamKey) {
    url.searchParams.set('_orca', streamKey)
  }
  return url.toString()
}

export function EmulatorScreenStreamContent({
  loading,
  onStreamError,
  onStreamSize,
  previewUrl,
  showStream,
  streamError,
  streamKey
}: EmulatorScreenStreamContentProps) {
  if (showStream && previewUrl) {
    return (
      <img
        key={`${previewUrl}::${streamKey ?? ''}`}
        src={simulatorMjpegSrc(previewUrl, streamKey)}
        alt="Simulator screen"
        className="block h-full w-full bg-black object-contain"
        draggable={false}
        onError={onStreamError}
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget
          if (naturalWidth <= 0 || naturalHeight <= 0) {
            return
          }
          onStreamSize({ width: naturalWidth, height: naturalHeight })
        }}
      />
    )
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/20 text-muted-foreground">
      {loading ? (
        <>
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-xs">Starting simulator…</span>
        </>
      ) : streamError ? (
        <span className="px-6 text-center text-xs">Stream disconnected</span>
      ) : (
        <span className="px-6 text-center text-xs">Simulator preview</span>
      )}
    </div>
  )
}
