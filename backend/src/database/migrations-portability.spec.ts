import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const migrationFiles = readdirSync(migrationsDir).filter((file) =>
  file.endsWith('.ts'),
);

describe('migrations', () => {
  it.each(migrationFiles)('%s runs on both MySQL and MariaDB', (file) => {
    const source = readFileSync(join(migrationsDir, file), 'utf8');
    expect(source).not.toMatch(/DROP CHECK/i);
  });
});
