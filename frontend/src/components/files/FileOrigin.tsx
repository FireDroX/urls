import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { StoredFileLink } from '#api/files'
import { shareDetailPath } from '#api/shares'

export function FileOrigin({ link }: { link: StoredFileLink }) {
  const { t } = useTranslation()
  const label = `${t(`files.origin.${link.type}`)} ${link.publicId}`

  if (link.type === 'share' && !link.deleted) {
    return (
      <Link to={shareDetailPath(link.publicId)} className="font-medium underline-offset-4 hover:underline">
        {label}
      </Link>
    )
  }
  return (
    <span>
      {label}
      {link.deleted && (
        <span className="ml-2 text-xs text-muted-foreground">
          {t(link.type === 'share' ? 'files.origin.shareDeleted' : 'files.origin.linkDeleted')}
        </span>
      )}
    </span>
  )
}
