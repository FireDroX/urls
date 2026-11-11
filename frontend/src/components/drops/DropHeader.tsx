import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicDrop } from '#api/public-drops'
import { Mascot } from '#components/Logo'
import { useFileSize } from '#hooks/useFileSize'

export function DropHeader({ drop }: { drop: PublicDrop }) {
  const { t, i18n } = useTranslation()
  const formatSize = useFileSize()

  const expiry = useMemo(() => {
    if (!drop.expiresAt) return null
    const formatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' })
    return formatter.format(new Date(drop.expiresAt))
  }, [drop.expiresAt, i18n.language])

  return (
    <header className="flex items-center gap-4">
      <Mascot className="h-14 shrink-0" />
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-bold">{drop.title ?? t('dropUpload.untitled')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('dropUpload.filesRemaining', { count: drop.filesRemaining, max: drop.maxFiles })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('dropUpload.bytesRemaining', {
            remaining: formatSize(drop.bytesRemaining),
            total: formatSize(drop.maxTotalBytes),
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {expiry ? t('dropUpload.closesAt', { date: expiry }) : t('dropUpload.noExpiry')}
        </p>
      </div>
    </header>
  )
}
