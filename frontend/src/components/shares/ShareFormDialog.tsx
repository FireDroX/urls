import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createShare, updateShare, type Share, type ShareDetail } from '#api/shares'
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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Switch } from '#components/ui/switch'
import { useUploads } from '#hooks/useUploads'
import { extractErrorMessage } from '#lib/api-errors'
import { shareErrorMessages } from '#lib/share-errors'
import {
  createShareFormSchema,
  shareFormDefaults,
  toCreateSharePayload,
  toUpdateSharePayload,
  type ShareFormValues,
} from '#schemas/share.schema'

interface ShareFormDialogProps<Saved extends Share> {
  open: boolean
  share?: Saved
  onOpenChange: (open: boolean) => void
  onSaved: (share: Saved | ShareDetail) => void
}

interface ShareFormProps<Saved extends Share> {
  share?: Saved
  onSaved: (share: Saved | ShareDetail) => void
}

async function saveShare<Saved extends Share>(
  share: Saved | undefined,
  values: ShareFormValues,
): Promise<Saved | ShareDetail> {
  if (!share) {
    return createShare(toCreateSharePayload(values))
  }
  const payload = toUpdateSharePayload(share, values)
  return Object.keys(payload).length === 0 ? share : updateShare(share.id, payload)
}

function ShareForm<Saved extends Share>({ share, onSaved }: ShareFormProps<Saved>) {
  const { t } = useTranslation()
  const { hasActiveUploads } = useUploads(share?.id ?? '')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createShareFormSchema(t, share), [t, share])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<ShareFormValues>({ resolver: zodResolver(schema), defaultValues: shareFormDefaults(share) })

  async function onSubmit(values: ShareFormValues) {
    setSubmitError(null)
    try {
      onSaved(await saveShare(share, values))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, undefined, shareErrorMessages(t)))
    }
  }

  function slugHelp(): string {
    if (hasActiveUploads) return t('shares.form.slugLocked')
    return share ? t('shares.form.slugEditHelp') : t('links.form.slugHelp')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="share-slug">{share ? t('links.form.slug') : t('links.form.slugOptional')}</FieldLabel>
              <Input
                {...field}
                id="share-slug"
                autoComplete="off"
                spellCheck={false}
                disabled={hasActiveUploads}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{slugHelp()}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="expiresAt"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="share-expires-at">{t('links.form.expiresAt')}</FieldLabel>
              <div className="flex gap-2">
                <Input {...field} id="share-expires-at" type="datetime-local" aria-invalid={!!fieldState.error} />
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
              <FieldLabel htmlFor="share-max-downloads">{t('shares.form.maxDownloads')}</FieldLabel>
              <Input
                {...field}
                id="share-max-downloads"
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
        {share && (
          <Controller
            control={control}
            name="disabled"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="share-disabled" checked={field.value} onCheckedChange={field.onChange} />
                <FieldContent>
                  <FieldLabel htmlFor="share-disabled">{t('links.form.disabled')}</FieldLabel>
                  <FieldDescription>{t('links.form.disabledHelp')}</FieldDescription>
                </FieldContent>
              </Field>
            )}
          />
        )}
        <FormError message={submitError} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {share ? t('links.form.save') : t('links.form.create')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function ShareFormDialog<Saved extends Share>({ open, share, onOpenChange, onSaved }: ShareFormDialogProps<Saved>) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{share ? t('shares.form.editTitle') : t('shares.form.createTitle')}</DialogTitle>
          <DialogDescription>
            {share ? t('shares.form.editDescription') : t('shares.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <ShareForm share={share} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}
