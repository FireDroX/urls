import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
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

interface ConfirmDeleteDialogProps {
  open: boolean
  title: string
  description: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  errorMessage: (error: unknown) => string
}

type ConfirmBodyProps = Omit<ConfirmDeleteDialogProps, 'open' | 'onOpenChange'>

function ConfirmBody({ title, description, onConfirm, errorMessage }: ConfirmBodyProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await onConfirm()
    } catch (deleteError) {
      setError(errorMessage(deleteError))
      setPending(false)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
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

export function ConfirmDeleteDialog({ open, onOpenChange, ...body }: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <ConfirmBody {...body} />
      </AlertDialogContent>
    </AlertDialog>
  )
}
