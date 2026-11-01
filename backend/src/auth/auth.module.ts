import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module.js';
import { SecurityModule } from '../security/security.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './services/auth.service.js';

@Module({
  imports: [UsersModule, JwtModule.register({}), SecurityModule, AuditModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
