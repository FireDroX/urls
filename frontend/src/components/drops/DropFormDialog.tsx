import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { createDrop, updateDrop, type Drop } from '#api/drops'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { extractErrorMessage } from '#lib/api-errors'
import { dropErrorMessages } from '#lib/drop-errors'
import {
  createDropFormSchema,
  DROP_SIZE_UNITS,
  dropFormDefaults,
  toCreateDropPayload,
  toUpdateDropPayload,
  type DropFormValues,
} from '#schemas/drop.schema'

interface DropFormDialogProps {
  open: boolean
  drop?: Drop
  onOpenChange: (open: boolean) => void
  onSaved: (drop: Drop) => void
}

async function saveDrop(drop: Drop | undefined, values: DropFormValues): Promise<Drop> {
  if (!drop) {
    return createDrop(toCreateDropPayload(values))
  }
  const payload = toUpdateDropPayload(drop, values)
  return Object.keys(payload).length === 0 ? drop : updateDrop(drop.id, payload)
}

function DropForm({ drop, onSaved }: { drop?: Drop; onSaved: (drop: Drop) => void }) {
  const { t } = useTranslation()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const schema = useMemo(() => createDropFormSchema(t, drop), [t, drop])
  const defaultValues = useMemo(() => dropFormDefaults(drop), [drop])
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<DropFormValues>({ resolver: zodResolver(schema), defaultValues })

  async function onSubmit(values: DropFormValues) {
    setSubmitError(null)
    try {
      onSaved(await saveDrop(drop, values))
    } catch (error) {
      setSubmitError(extractErrorMessage(error, undefined, dropErrorMessages(t)))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="drop-title">{t('drops.form.title')}</FieldLabel>
              <Input {...field} id="drop-title" autoComplete="off" aria-invalid={!!fieldState.error} />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('drops.form.titleHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="slug"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="drop-slug">{drop ? t('links.form.slug') : t('links.form.slugOptional')}</FieldLabel>
              <Input
                {...field}
                id="drop-slug"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{drop ? t('drops.form.slugEditHelp') : t('links.form.slugHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="maxFiles"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="drop-max-files">{t('drops.form.maxFiles')}</FieldLabel>
              <Input
                {...field}
                id="drop-max-files"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!fieldState.error}
              />
              {fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('drops.form.maxFilesHelp')}</FieldDescription>
              )}
            </Field>
          )}
        />
        <Field data-invalid={false}>
          <FieldLabel htmlFor="drop-max-total-size">{t('drops.form.maxTotalSize')}</FieldLabel>
          <div className="flex gap-2">
            <Controller
              control={control}
              name="maxTotalSize"
              render={({ field, fieldState }) => (
                <Input
                  {...field}
                  id="drop-max-total-size"
                  inputMode="numeric"
                  autoComplete="off"
                  aria-invalid={!!fieldState.error}
                />
              )}
            />
            <Controller
              control={control}
              name="maxTotalUnit"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label={t('drops.form.unit')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DROP_SIZE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {t(`drops.form.units.${unit}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <Controller
            control={control}
            name="maxTotalSize"
            render={({ fieldState }) =>
              fieldState.error ? (
                <FieldError>{fieldState.error.message}</FieldError>
              ) : (
                <FieldDescription>{t('drops.form.maxTotalSizeHelp')}</FieldDescription>
              )
            }
          />
        </Field>
        <Controller
          control={control}
          name="expiresAt"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="drop-expires-at">{t('links.form.expiresAt')}</FieldLabel>
              <div className="flex gap-2">
                <Input {...field} id="drop-expires-at" type="datetime-local" aria-invalid={!!fieldState.error} />
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
                <FieldDescription>{t('drops.form.expiresAtHelp')}</FieldDescription>
              )}
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
            {drop ? t('links.form.save') : t('links.form.create')}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

export function DropFormDialog({ open, drop, onOpenChange, onSaved }: DropFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{drop ? t('drops.form.editTitle') : t('drops.form.createTitle')}</DialogTitle>
          <DialogDescription>
            {drop ? t('drops.form.editDescription') : t('drops.form.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <DropForm drop={drop} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}
