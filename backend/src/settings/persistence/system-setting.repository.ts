import type { SystemSetting } from '../entities/system-setting.entity.js';

export interface SystemSettingRepository {
  findAll(): Promise<SystemSetting[]>;
  upsert(key: string, value: string): Promise<SystemSetting>;
}
