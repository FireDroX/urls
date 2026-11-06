import { z } from 'zod';

export const listFilesQuerySchema = z.strictObject({
  orphans: z.literal('true').optional(),
});

export type ListFilesQueryDto = z.infer<typeof listFilesQuerySchema>;
