import { QueryFailedError } from 'typeorm';

const MYSQL_DUPLICATE_ENTRY = 'ER_DUP_ENTRY';
const MYSQL_NO_REFERENCED_ROW = 'ER_NO_REFERENCED_ROW_2';

function driverError(
  error: unknown,
): { code?: string; sqlMessage?: string } | undefined {
  return error instanceof QueryFailedError
    ? (error.driverError as { code?: string; sqlMessage?: string } | undefined)
    : undefined;
}

export function isDuplicateEntry(error: unknown): boolean {
  return driverError(error)?.code === MYSQL_DUPLICATE_ENTRY;
}

export function isForeignKeyViolation(
  error: unknown,
  constraintName: string,
): boolean {
  const driver = driverError(error);
  return (
    driver?.code === MYSQL_NO_REFERENCED_ROW &&
    String(driver.sqlMessage ?? '').includes(constraintName)
  );
}
