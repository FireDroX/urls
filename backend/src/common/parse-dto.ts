import type { z } from 'zod';
import { ValidationException } from './exceptions/validation.exception.js';

export function parseDto<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const messages = result.error.issues.map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}: ${issue.message}`
        : issue.message,
    );
    throw new ValidationException(messages.join(', '));
  }
  return result.data;
}
