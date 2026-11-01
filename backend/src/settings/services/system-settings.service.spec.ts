import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogService } from '../../audit/services/audit-log.service.js';
import { InvalidSettingValueException } from '../../common/exceptions/settings/invalid-setting-value.exception.js';
import { UnknownSettingException } from '../../common/exceptions/settings/unknown-setting.exception.js';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import type { SystemSettingRepository } from '../persistence/system-setting.repository.js';
import { SystemSettingsService } from './system-settings.service.js';

describe('SystemSettingsService', () => {
  let repository: {
    findAll: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  let audit: { record: ReturnType<typeof vi.fn> };
  let service: SystemSettingsService;

  beforeEach(() => {
    repository = { findAll: vi.fn().mockResolvedValue([]), upsert: vi.fn() };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new SystemSettingsService(
      repository as unknown as SystemSettingRepository,
      audit as unknown as AuditLogService,
    );
  });

  it('falls back to French when nothing is stored', async () => {
    await expect(service.get()).resolves.toEqual({ locale: 'fr' });
  });

  it('ignores stored values that are no longer allowed', async () => {
    repository.findAll.mockResolvedValue([
      { key: 'locale', value: 'de' },
      { key: 'legacy', value: 'x' },
    ]);

    await expect(service.get()).resolves.toEqual({ locale: 'fr' });
  });

  it('switches the interface to English and audits the change', async () => {
    repository.findAll.mockResolvedValue([{ key: 'locale', value: 'en' }]);

    await expect(
      service.update('locale', { value: 'en' }, 'user-1'),
    ).resolves.toEqual({ locale: 'en' });
    expect(repository.upsert).toHaveBeenCalledWith('locale', 'en');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'settings.updated',
        targetId: 'locale',
      }),
    );
  });

  it('rejects an unsupported language', async () => {
    await expect(
      service.update('locale', { value: 'de' }, 'user-1'),
    ).rejects.toBeInstanceOf(InvalidSettingValueException);
  });

  it.each(['theme', '__proto__', 'constructor'])(
    'rejects the unknown key %s',
    async (key) => {
      await expect(
        service.update(key, { value: 'fr' }, 'user-1'),
      ).rejects.toBeInstanceOf(UnknownSettingException);
    },
  );

  it('rejects a malformed body', async () => {
    await expect(
      service.update('locale', { value: 'fr', extra: true }, 'user-1'),
    ).rejects.toBeInstanceOf(ValidationException);
  });
});
