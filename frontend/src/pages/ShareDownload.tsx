import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { isAxiosError } from 'axios'
import { DownloadIcon, FileIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { requestShareDownload, type PublicShare, type PublicShareFile } from '#api/public-shares'
import { FormError } from '#components/FormError'
import { Mascot } from '#components/Logo'
import { StatusMessage } from '#components/StatusMessage'
import { TurnstileWidget } from '#components/Turnstile'
import { Button } from '#components/ui/button'
import { Skeleton } from '#components/ui/skeleton'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { useFileSize } from '#hooks/useFileSize'
import { usePublicShare } from '#hooks/usePublicShare'
import { extractErrorMessage } from '#lib/api-errors'
import { LinkExpired } from '#pages/LinkExpired'
import { NotFound } from '#pages/NotFound'
import { startDownload } from '#utils/start-download'

const BAD_REQUEST = 400
const NOT_FOUND = 404
const GONE = 410

interface SharePreviewProps {
  share: PublicShare
  onExpired: () => void
  onStale: () => void
}

function ShareFileRow({
  file,
  disabled,
  pending,
  onDownload,
}: {
  file: PublicShareFile
  disabled: boolean
  pending: boolean
  onDownload: (file: PublicShareFile) => void
}) {
  const { t } = useTranslation()
  const formatSize = useFileSize()

  return (
    <li className="flex items-center gap-3 py-3">
      <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
      </div>
      <Button
        size="sm"
        disabled={disabled}
        aria-label={t('share.downloadFile', { name: file.name })}
        onClick={() => onDownload(file)}
      >
        <DownloadIcon aria-hidden />
        {pending ? t('share.preparing') : t('share.download')}
      </Button>
    </li>
  )
}

function SharePreview({ share, onExpired, onStale }: SharePreviewProps) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)
  const [pendingFileId, setPendingFileId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle(t('share.title'))

  const expiry = useMemo(() => {
    if (!share.expiresAt) return null
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' })
    return formatter.format(new Date(share.expiresAt))
  }, [share.expiresAt, i18n.language])

  function handleDownloadError(downloadError: unknown) {
    const status = isAxiosError(downloadError) ? downloadError.response?.status : undefined
    if (status === GONE) {
      onExpired()
      return
    }
    if (status === NOT_FOUND) {
      onStale()
      return
    }
    setError(status === BAD_REQUEST ? t('share.verificationFailed') : extractErrorMessage(downloadError))
  }

  async function download(file: PublicShareFile) {
    if (turnstileToken === null || pendingFileId !== null) return
    setPendingFileId(file.id)
    setError(null)
    try {
      startDownload(await requestShareDownload(share.id, file.id, turnstileToken || undefined))
    } catch (downloadError) {
      handleDownloadError(downloadError)
    } finally {
      setPendingFileId(null)
      setTurnstileResetKey((key) => key + 1)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <main className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-4">
          <Mascot className="h-14 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold">{t('share.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('share.summary', { count: share.fileCount, size: formatSize(share.totalSize) })}
            </p>
            <p className="text-sm text-muted-foreground">
              {expiry ? t('share.expiresAt', { date: expiry }) : t('share.noExpiry')}
            </p>
          </div>
        </header>
        <ul aria-label={t('share.filesRegion')} className="divide-y divide-border border-y border-border">
          {share.files.map((file) => (
            <ShareFileRow
              key={file.id}
              file={file}
              disabled={turnstileToken === null || pendingFileId !== null}
              pending={pendingFileId === file.id}
              onDownload={(selected) => void download(selected)}
            />
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-3">
          <TurnstileWidget
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            resetKey={turnstileResetKey}
          />
          {turnstileToken === null && <p className="text-sm text-muted-foreground">{t('share.verifyHint')}</p>}
          <FormError message={error} />
        </div>
      </main>
    </div>
  )
}

function ShareSkeleton() {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <Skeleton className="h-64 w-full max-w-lg" />
    </div>
  )
}

export function ShareDownload() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const { state, expire, reload } = usePublicShare(id)

  switch (state.status) {
    case 'loading':
      return <ShareSkeleton />
    case 'notFound':
      return <NotFound />
    case 'expired':
      return <LinkExpired />
    case 'failed':
      return (
        <StatusMessage title={t('share.loadFailedTitle')} body={state.message}>
          <Button variant="outline" onClick={reload}>
            {t('common.retry')}
          </Button>
        </StatusMessage>
      )
    case 'ready':
      return <SharePreview share={state.share} onExpired={expire} onStale={reload} />
  }
}
