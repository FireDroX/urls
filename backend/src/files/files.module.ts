import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { StoredFile } from './entities/stored-file.entity.js';
import { TypeormStoredFileRepository } from './persistence/typeorm.stored-file.repository.js';
import { FilesController } from './files.controller.js';
import { FileDeletionService } from './services/file-deletion.service.js';
import { FilesAdminService } from './services/files-admin.service.js';
import { FileUploadsService } from './services/file-uploads.service.js';
import { FileVerificationService } from './services/file-verification.service.js';
import { FilesService } from './services/files.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFile]), AuditModule, StorageModule],
  controllers: [FilesController],
  providers: [
    { provide: 'FilesRepository', useClass: TypeormStoredFileRepository },
    FilesService,
    FileUploadsService,
    FileDeletionService,
    FilesAdminService,
    FileVerificationService,
  ],
  exports: [FilesService, FileUploadsService, FileDeletionService],
})
export class FilesModule {}
