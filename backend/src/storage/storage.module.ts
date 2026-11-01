import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './services/s3.storage.service.js';
import {
  s3ClientFor,
  storageSettingsFrom,
  type StorageSettings,
} from './storage.config.js';
import { StorageController } from './storage.controller.js';

@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: 'StorageSettings',
      inject: [ConfigService],
      useFactory: storageSettingsFrom,
    },
    {
      provide: 'S3InternalClient',
      inject: ['StorageSettings'],
      useFactory: (settings: StorageSettings) =>
        s3ClientFor(settings, settings.endpoint),
    },
    {
      provide: 'S3PresignClient',
      inject: ['StorageSettings'],
      useFactory: (settings: StorageSettings) =>
        s3ClientFor(settings, settings.publicEndpoint),
    },
    { provide: 'StorageService', useClass: S3StorageService },
  ],
  exports: ['StorageService'],
})
export class StorageModule {}
