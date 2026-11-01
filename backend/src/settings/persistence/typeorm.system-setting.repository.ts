import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../entities/system-setting.entity.js';
import type { SystemSettingRepository } from './system-setting.repository.js';

@Injectable()
export class TypeormSystemSettingRepository implements SystemSettingRepository {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly repository: Repository<SystemSetting>,
  ) {}

  findAll(): Promise<SystemSetting[]> {
    return this.repository.find();
  }

  async upsert(key: string, value: string): Promise<SystemSetting> {
    await this.repository.upsert({ key, value }, ['key']);
    return { key, value };
  }
}
