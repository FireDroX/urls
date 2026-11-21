import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CircleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconTile } from '#components/IconTile'
import { Mascot } from '#components/Logo'
import { PublicFrame } from '#components/PublicFrame'
import { useDocumentTitle } from '#hooks/useDocumentTitle'

interface StatusMessageProps {
  title: string
  body: string
  footer?: string
  children?: ReactNode
}

export function StatusMessage({ title, body, footer, children }: StatusMessageProps) {
  const { t } = useTranslation()
  useDocumentTitle(title)

  if (footer !== undefined) {
    return (
      <PublicFrame footer={footer} className="flex flex-col items-start gap-3 p-7">
        <IconTile icon={CircleAlertIcon} />
        <h1 className="text-[26px] font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        {children}
        <Link to="/" className="text-sm text-link-accent underline-offset-4 hover:underline">
          {t('common.backHome')}
        </Link>
      </PublicFrame>
    )
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <Mascot className="h-20" />
      <h1 className="font-heading text-2xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {children}
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
        {t('common.backHome')}
      </Link>
    </div>
  )
}
