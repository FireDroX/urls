import type { TFunction } from 'i18next'
import { z } from 'zod'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 12
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

export function createLoginSchema(t: TFunction) {
  return z.object({
    email: z.string().trim().regex(EMAIL_REGEX, t('auth.validation.emailInvalid')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  })
}

export function createChangePasswordSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z.string().min(1, t('settings.validation.currentRequired')),
      newPassword: z
        .string()
        .min(MIN_PASSWORD_LENGTH, t('settings.validation.minLength', { count: MIN_PASSWORD_LENGTH }))
        .regex(PASSWORD_COMPLEXITY_REGEX, t('settings.validation.complexity')),
      confirmPassword: z.string(),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      path: ['confirmPassword'],
      message: t('settings.validation.mismatch'),
    })
}

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>
export type ChangePasswordFormValues = z.infer<ReturnType<typeof createChangePasswordSchema>>
