import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createLink, updateLink, type Link } from '#api/links'
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
import { extractErrorMessage } from '#lib/api-errors'
import { linkErrorMessages } from '#lib/link-errors'
import {
  createLinkFormSchema,
  linkFormDefaults,
  toCreateLinkPayload,
  toUpdateLinkPayload,
  type LinkFormValues,
} from '#schemas/link.schema'

interface LinkFormDialogProps {
  open: boolean
  link?: Link
  onOpenChange: (open: boolean) => void
  onSaved: (link: Link) => void
}

async function saveLink(link: Link | undefined, values: LinkFormValues): Promise<Link> {
  if (!link) {
    return createLink(toCreateLinkPayload(values))
  }
  const payload = toUpdateLinkPayload(link, values)
  return Object.keys(payload).length === 0 ? link : updateLink(link.id, payload)
}

function LinkForm({ link, onSaved }: { link?: Link; onSaved: (link: Link) => void }) {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createLinkFormSchema(t, link), [t, link])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<LinkFormValues>({ resolver: zodResolver(schema), defaultValues: linkFormDefaults(link) })

  async function onSubmit(values: LinkFormValues) {
    setSubmitError(null)
    try {
      onSaved(await saveLink(link, values))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, undefined, linkErrorMessages(t)))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="destination"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="link-destination">{t('links.form.destination')}</FieldLabel>
              <Input
                {...field}
                id="link-destination"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder={t('links.form.destinationPlaceholder')}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="link-slug">{link ? t('links.form.slug') : t('links.form.slugOptional')}</FieldLabel>
              <Input {...field} id="link-slug" autoComplete="off" spellCheck={false} aria-invalid={!!fieldState.error} />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{link ? t('links.form.slugEditHelp') : t('links.form.slugHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="expiresAt"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="link-expires-at">{t('links.form.expiresAt')}</FieldLabel>
              <div className="flex gap-2">
                <Input {...field} id="link-expires-at" type="datetime-local" aria-invalid={!!fieldState.error} />
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
                <FieldDescription>{t('links.form.expiresAtHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        {link && (
          <Controller
            control={control}
            name="disabled"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="link-disabled" checked={field.value} onCheckedChange={field.onChange} />
                <FieldContent>
                  <FieldLabel htmlFor="link-disabled">{t('links.form.disabled')}</FieldLabel>
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
            {link ? t('links.form.save') : t('links.form.create')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function LinkFormDialog({ open, link, onOpenChange, onSaved }: LinkFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{link ? t('links.form.editTitle') : t('links.form.createTitle')}</DialogTitle>
          <DialogDescription>{link ? t('links.form.editDescription') : t('links.form.createDescription')}</DialogDescription>
        </DialogHeader>
        <LinkForm link={link} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}
