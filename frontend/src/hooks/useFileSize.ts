import { useTranslation } from 'react-i18next'
import { formatFileSize } from '#utils/file-size'

export function useFileSize(): (bytes: number) => string {
  const { t, i18n } = useTranslation()
  const units = t('units.bytes', { returnObjects: true }) as string[]
  return (bytes) => formatFileSize(bytes, units, i18n.language)
}
