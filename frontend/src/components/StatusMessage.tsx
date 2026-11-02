import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Mascot } from '#components/Logo'
import { useDocumentTitle } from '#hooks/useDocumentTitle'

export function StatusMessage({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation()
  useDocumentTitle(title)

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <Mascot className="h-20" />
      <h1 className="font-heading text-2xl font-bold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
        {t('common.backHome')}
      </Link>
    </div>
  )
}
