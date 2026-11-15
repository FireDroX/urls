import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { isDuplicateEntry, isForeignKeyViolation } from './database-errors.js';

function queryError(code: string, sqlMessage = ''): QueryFailedError {
  return new QueryFailedError('SELECT 1', [], {
    code,
    sqlMessage,
  } as unknown as Error);
}

describe('isDuplicateEntry', () => {
  it('recognises ER_DUP_ENTRY only', () => {
    expect(isDuplicateEntry(queryError('ER_DUP_ENTRY'))).toBe(true);
    expect(isDuplicateEntry(queryError('ER_OTHER'))).toBe(false);
    expect(isDuplicateEntry(new Error('ER_DUP_ENTRY'))).toBe(false);
  });
});

describe('isForeignKeyViolation', () => {
  const message =
    'Cannot add or update a child row: a foreign key constraint fails (`urls`.`link_tags`, CONSTRAINT `FK_link_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`))';

  it('matches the named constraint', () => {
    expect(
      isForeignKeyViolation(
        queryError('ER_NO_REFERENCED_ROW_2', message),
        'FK_link_tags_tag',
      ),
    ).toBe(true);
  });

  it('ignores other constraints, other codes and other errors', () => {
    const error = queryError('ER_NO_REFERENCED_ROW_2', message);
    expect(isForeignKeyViolation(error, 'FK_links_folder')).toBe(false);
    expect(
      isForeignKeyViolation(
        queryError('ER_DUP_ENTRY', message),
        'FK_link_tags_tag',
      ),
    ).toBe(false);
    expect(isForeignKeyViolation(new Error(message), 'FK_link_tags_tag')).toBe(
      false,
    );
  });
});
