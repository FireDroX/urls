import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { linkUrl } from '#api/links'

export function useCopyLink(): (id: string) => Promise<void> {
  const { t } = useTranslation()

  return useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(linkUrl(id))
        toast.success(t('links.copied'))
      } catch {
        toast.error(t('links.copyFailed'))
      }
    },
    [t],
  )
}
