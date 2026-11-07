import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard.js';
import { JwtAuthModule } from './common/jwt-auth.module.js';
import {
  GLOBAL_THROTTLE_LIMIT,
  GLOBAL_THROTTLE_TTL_MS,
} from './common/variables.global.js';
import { validateEnvironment } from './config/env.validation.js';
import { typeOrmConfig } from './config/typeorm.config.js';
import { EventsModule } from './events/events.module.js';
import { FilesModule } from './files/files.module.js';
import { HealthModule } from './health/health.module.js';
import { LinksModule } from './links/links.module.js';
import { SecurityModule } from './security/security.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { DropsModule } from './drops/drops.module.js';
import { SharesModule } from './shares/shares.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    ThrottlerModule.forRoot([
      { ttl: GLOBAL_THROTTLE_TTL_MS, limit: GLOBAL_THROTTLE_LIMIT },
    ]),
    JwtAuthModule,
    HealthModule,
    SecurityModule,
    AuditModule,
    UsersModule,
    AuthModule,
    StorageModule,
    SettingsModule,
    EventsModule,
    LinksModule,
    FilesModule,
    SharesModule,
    DropsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
})
export class AppModule {}
