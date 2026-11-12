import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { shareDropFiles, type DropFile } from '#api/drops'
import type { ShareDetail } from '#api/shares'
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { useFileSize } from '#hooks/useFileSize'
import { isShareDropFilesStale, shareDropFilesErrorMessage } from '#lib/drop-errors'
import {
  createShareDropFilesSchema,
  shareDropFilesDefaults,
  toShareDropFilesPayload,
  type ShareDropFilesFormValues,
} from '#schemas/share-drop-files.schema'

const CHECKBOX_CLASS = 'size-4 shrink-0 accent-primary'

interface ShareDropFilesFormProps {
  dropId: string
  readyFiles: DropFile[]
  onShared: (share: ShareDetail) => void
  onStale: () => void
}

interface ShareDropFilesDialogProps extends Omit<ShareDropFilesFormProps, 'readyFiles'> {
  open: boolean
  files: DropFile[]
  onOpenChange: (open: boolean) => void
}

function ShareDropFilesForm({ dropId, readyFiles, onShared, onStale }: ShareDropFilesFormProps) {
  const { t } = useTranslation()
  const formatSize = useFileSize()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createShareDropFilesSchema(t), [t])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<ShareDropFilesFormValues>({
    resolver: zodResolver(schema),
    defaultValues: shareDropFilesDefaults(readyFiles.map((file) => file.id)),
  })

  async function onSubmit(values: ShareDropFilesFormValues) {
    setSubmitError(null)
    try {
      onShared(await shareDropFiles(dropId, toShareDropFilesPayload(values)))
    } catch (error) {
      setSubmitError(shareDropFilesErrorMessage(t, error))
      if (isShareDropFilesStale(error)) onStale()
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="fileIds"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel>{t('drops.share.files')}</FieldLabel>
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {readyFiles.map((file) => (
                  <li key={file.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={field.value.includes(file.id)}
                        onChange={(event) =>
                          field.onChange(
                            event.target.checked
                              ? [...field.value, file.id]
                              : field.value.filter((id) => id !== file.id),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground tabular-nums">{formatSize(file.size)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="share-drop-slug">{t('links.form.slugOptional')}</FieldLabel>
              <Input
                {...field}
                id="share-drop-slug"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('links.form.slugHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="expiresAt"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="share-drop-expires-at">{t('links.form.expiresAt')}</FieldLabel>
              <div className="flex gap-2">
                <Input {...field} id="share-drop-expires-at" type="datetime-local" aria-invalid={!!fieldState.error} />
                {field.value !== '' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setValue('expiresAt', '', { shouldDirty: true, shouldValidate: true })}
                  >
                    {t('links.form.noExpiry')}
                  </Button>
                )}
              </div>
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('shares.form.expiresAtHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="maxDownloads"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="share-drop-max-downloads">{t('shares.form.maxDownloads')}</FieldLabel>
              <Input
                {...field}
                id="share-drop-max-downloads"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('shares.form.maxDownloadsHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="closeDrop"
          render={({ field }) => (
            <Field>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
                {t('drops.share.closeDrop')}
              </label>
              <FieldDescription>{t('drops.share.closeDropHelp')}</FieldDescription>
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
            {t('drops.share.submit')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function ShareDropFilesDialog({ open, files, onOpenChange, ...rest }: ShareDropFilesDialogProps) {
  const { t } = useTranslation()
  const readyFiles = useMemo(() => files.filter((file) => file.status === 'ready'), [files])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('drops.share.title')}</DialogTitle>
          <DialogDescription>{t('drops.share.description')}</DialogDescription>
        </DialogHeader>
        <ShareDropFilesForm {...rest} readyFiles={readyFiles} />
      </DialogContent>
    </Dialog>
  )
}
