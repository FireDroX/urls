import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { Folder } from './entities/folder.entity.js';
import { TypeormFolderRepository } from './persistence/typeorm.folder.repository.js';
import { FoldersService } from './services/folders.service.js';
import { FoldersController } from './folders.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Folder]), AuditModule],
  controllers: [FoldersController],
  providers: [
    { provide: 'FoldersRepository', useClass: TypeormFolderRepository },
    FoldersService,
  ],
  exports: [FoldersService],
})
export class FoldersModule {}
