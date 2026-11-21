import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { dropDetailPath } from '#api/drops'
import type { StoredFileLink, StoredFileLinkType } from '#api/files'
import { shareDetailPath } from '#api/shares'

const DETAIL_PATHS: Partial<Record<StoredFileLinkType, (publicId: string) => string>> = {
  share: shareDetailPath,
  drop: dropDetailPath,
}

const DELETED_LABELS: Record<StoredFileLinkType, string> = {
  redirect: 'files.origin.linkDeleted',
  share: 'files.origin.shareDeleted',
  drop: 'files.origin.dropDeleted',
}

export function FileOrigin({ link }: { link: StoredFileLink }) {
  const { t } = useTranslation()
  const label = `${t(`files.origin.${link.type}`)} ${link.publicId}`
  const detailPath = DETAIL_PATHS[link.type]

  if (detailPath && !link.deleted) {
    return (
      <Link to={detailPath(link.publicId)} className="font-medium underline-offset-4 hover:underline">
        {label}
      </Link>
    )
  }
  return (
    <span>
      {label}
      {link.deleted && <span className="ml-2 text-xs text-muted-foreground">{t(DELETED_LABELS[link.type])}</span>}
    </span>
  )
}
