import { Inject, Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/services/audit-log.service.js';
import { InvalidSettingValueException } from '../../common/exceptions/settings/invalid-setting-value.exception.js';
import { UnknownSettingException } from '../../common/exceptions/settings/unknown-setting.exception.js';
import { parseDto } from '../../common/parse-dto.js';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from '../../common/variables.global.js';
import { updateSettingSchema } from '../dto/in/update-setting.dto.js';
import type { SystemSettingRepository } from '../persistence/system-setting.repository.js';

export interface Settings {
  locale: string;
}

type SettingKey = keyof Settings;

const ALLOWED_VALUES: Record<SettingKey, readonly string[]> = {
  locale: SUPPORTED_LOCALES,
};

const DEFAULTS: Settings = { locale: DEFAULT_LOCALE };

function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(ALLOWED_VALUES, key);
}

@Injectable()
export class SystemSettingsService {
  constructor(
    @Inject('SystemSettingsRepository')
    private readonly repository: SystemSettingRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async get(): Promise<Settings> {
    const settings: Settings = { ...DEFAULTS };
    for (const { key, value } of await this.repository.findAll()) {
      if (isSettingKey(key) && ALLOWED_VALUES[key].includes(value)) {
        settings[key] = value;
      }
    }
    return settings;
  }

  async update(key: string, input: unknown, userId: string): Promise<Settings> {
    if (!isSettingKey(key)) {
      throw new UnknownSettingException();
    }
    const { value } = parseDto(updateSettingSchema, input);
    if (!ALLOWED_VALUES[key].includes(value)) {
      throw new InvalidSettingValueException(
        `value must be one of: ${ALLOWED_VALUES[key].join(', ')}`,
      );
    }
    await this.repository.upsert(key, value);
    await this.auditLog.record({
      action: 'settings.updated',
      userId,
      targetId: key,
      metadata: { value },
    });
    return this.get();
  }
}
