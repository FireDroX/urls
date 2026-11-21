import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { isAxiosError } from 'axios'
import { ClockIcon, DownloadIcon, FileIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { requestShareDownload, type PublicShare, type PublicShareFile } from '#api/public-shares'
import { FormError } from '#components/FormError'
import { IconTile } from '#components/IconTile'
import { PublicFrame } from '#components/PublicFrame'
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
    <li className="flex items-center gap-3 border-b border-table-divider px-4 py-3 text-sm last:border-b-0">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={file.name}>
        {file.name}
      </span>
      <span className="text-[13px] text-muted-foreground">{formatSize(file.size)}</span>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={t('share.downloadFile', { name: file.name })}
        title={pending ? t('share.preparing') : t('share.download')}
        onClick={() => onDownload(file)}
      >
        <DownloadIcon aria-hidden />
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
    <PublicFrame footer={t('publicFrame.shareFooter')}>
      <header className="flex flex-col items-start gap-2.5 px-7 pt-7 pb-5">
        <IconTile icon={DownloadIcon} />
        <h1 className="text-[26px] font-bold">{t('share.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('share.summary', { count: share.fileCount, size: formatSize(share.totalSize) })}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-state-neutral-bg px-2.5 py-1 text-[13px] text-state-neutral">
          <ClockIcon className="size-3.5" aria-hidden />
          {expiry ? t('share.expiresAt', { date: expiry }) : t('share.noExpiry')}
        </span>
      </header>
      <ul aria-label={t('share.filesRegion')} className="border-t border-border">
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
      <div className="flex flex-col gap-3.5 border-t border-border px-7 pt-5 pb-7">
        <TurnstileWidget
          onVerify={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          resetKey={turnstileResetKey}
        />
        {turnstileToken === null && (
          <p className="text-center text-xs text-muted-foreground">{t('share.verifyHint')}</p>
        )}
        <FormError message={error} />
      </div>
    </PublicFrame>
  )
}

function ShareSkeleton() {
  const { t } = useTranslation()
  return (
    <PublicFrame footer={t('publicFrame.shareFooter')}>
      <Skeleton className="h-64 w-full" />
    </PublicFrame>
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
      return <NotFound footer={t('publicFrame.shareFooter')} />
    case 'expired':
      return <LinkExpired footer={t('publicFrame.shareFooter')} />
    case 'failed':
      return (
        <StatusMessage title={t('share.loadFailedTitle')} body={state.message} footer={t('publicFrame.shareFooter')}>
          <Button variant="outline" onClick={reload}>
            {t('common.retry')}
          </Button>
        </StatusMessage>
      )
    case 'ready':
      return <SharePreview share={state.share} onExpired={expire} onStale={reload} />
  }
}
