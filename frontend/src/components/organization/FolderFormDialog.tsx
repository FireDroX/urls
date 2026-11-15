import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createFolder, updateFolder, type Folder } from '#api/folders'
import { FormError } from '#components/FormError'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { extractErrorMessage } from '#lib/api-errors'
import { folderErrorMessages } from '#lib/folder-errors'
import {
  createFolderFormSchema,
  folderFormDefaults,
  toFolderPayload,
  type FolderFormValues,
} from '#schemas/folder.schema'

interface FolderFormDialogProps {
  open: boolean
  folder?: Folder
  onOpenChange: (open: boolean) => void
  onSaved: (folder: Folder) => void
}

async function saveFolder(folder: Folder | undefined, values: FolderFormValues): Promise<Folder> {
  if (!folder) {
    return createFolder(toFolderPayload(values))
  }
  return values.name === folder.name ? folder : updateFolder(folder.id, toFolderPayload(values))
}

function FolderForm({ folder, onSaved }: { folder?: Folder; onSaved: (folder: Folder) => void }) {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createFolderFormSchema(t), [t])
  const defaultValues = useMemo(() => folderFormDefaults(folder), [folder])
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FolderFormValues>({ resolver: zodResolver(schema), defaultValues })

  async function onSubmit(values: FolderFormValues) {
    setSubmitError(null)
    try {
      onSaved(await saveFolder(folder, values))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, undefined, folderErrorMessages(t)))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="folder-name">{t('organization.folders.form.name')}</FieldLabel>
              <Input {...field} id="folder-name" autoComplete="off" aria-invalid={!!fieldState.error} />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <FormError message={submitError} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {folder ? t('links.form.save') : t('links.form.create')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function FolderFormDialog({ open, folder, onOpenChange, onSaved }: FolderFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {folder ? t('organization.folders.form.editTitle') : t('organization.folders.form.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {folder ? t('organization.folders.form.editDescription') : t('organization.folders.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <FolderForm folder={folder} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}
