import { QueryFailedError } from 'typeorm';

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';

export function isDuplicateEntry(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      MYSQL_DUPLICATE_ENTRY
  );
}
