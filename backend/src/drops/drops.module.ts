import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { FilesModule } from '../files/files.module.js';
import { Link } from '../links/entities/link.entity.js';
import { DropsController } from './drops.controller.js';
import { TypeormDropRepository } from './persistence/typeorm.drop.repository.js';
import { DropsService } from './services/drops.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Link]), AuditModule, FilesModule],
  controllers: [DropsController],
  providers: [
    { provide: 'DropsRepository', useClass: TypeormDropRepository },
    DropsService,
  ],
})
export class DropsModule {}
