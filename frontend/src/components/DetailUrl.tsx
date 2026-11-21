import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'

interface DetailUrlProps {
  url: string
  slug: string
  onCopy: () => void
}

export function DetailUrl({ url, slug, onCopy }: DetailUrlProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[13px] text-link-accent">{url}</span>
      <Button variant="ghost" size="icon-sm" aria-label={t('links.copy', { slug })} onClick={onCopy}>
        <Copy />
      </Button>
    </div>
  )
}
