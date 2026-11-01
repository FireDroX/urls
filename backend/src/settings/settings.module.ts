import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { TypeormSystemSettingRepository } from './persistence/typeorm.system-setting.repository.js';
import { SystemSettingsService } from './services/system-settings.service.js';
import { SettingsController } from './settings.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([SystemSetting]), AuditModule],
  controllers: [SettingsController],
  providers: [
    {
      provide: 'SystemSettingsRepository',
      useClass: TypeormSystemSettingRepository,
    },
    SystemSettingsService,
  ],
})
export class SettingsModule {}
