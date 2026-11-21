import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteLink, type Link } from '#api/links'
import { FormError } from '#components/FormError'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#components/ui/alert-dialog'
import { extractErrorMessage } from '#lib/api-errors'
import { linkErrorMessages } from '#lib/link-errors'

interface DeleteLinkDialogProps {
  open: boolean
  link?: Link
  onOpenChange: (open: boolean) => void
  onDeleted: (link: Link) => void
}

function DeleteLinkBody({ link, onDeleted }: { link: Link; onDeleted: (link: Link) => void }) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await deleteLink(link.id)
      onDeleted(link)
    } catch (deleteError) {
      setError(extractErrorMessage(deleteError, undefined, linkErrorMessages(t)))
      setPending(false)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('links.delete.title')}</AlertDialogTitle>
        <AlertDialogDescription>{t('links.delete.description', { slug: link.id })}</AlertDialogDescription>
      </AlertDialogHeader>
      <FormError message={error} />
      <AlertDialogFooter>
        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={pending} onClick={handleConfirm}>
          {t('links.delete.confirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

export function DeleteLinkDialog({ open, link, onOpenChange, onDeleted }: DeleteLinkDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>{link && <DeleteLinkBody link={link} onDeleted={onDeleted} />}</AlertDialogContent>
    </AlertDialog>
  )
}
