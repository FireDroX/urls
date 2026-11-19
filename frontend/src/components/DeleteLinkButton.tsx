import { Trash } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'

export function DeleteLinkButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()

  return (
    <Button
      variant="outline"
      className="border-danger-border text-state-danger hover:bg-state-danger-bg hover:text-state-danger dark:border-danger-border"
      onClick={onClick}
    >
      <Trash />
      {t('links.delete.action')}
    </Button>
  )
}
