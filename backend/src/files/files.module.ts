import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { StoredFile } from './entities/stored-file.entity.js';
import { TypeormStoredFileRepository } from './persistence/typeorm.stored-file.repository.js';
import { FileUploadsService } from './services/file-uploads.service.js';
import { FileVerificationService } from './services/file-verification.service.js';
import { FilesService } from './services/files.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFile]), AuditModule, StorageModule],
  providers: [
    { provide: 'FilesRepository', useClass: TypeormStoredFileRepository },
    FilesService,
    FileUploadsService,
    FileVerificationService,
  ],
  exports: [FilesService, FileUploadsService],
})
export class FilesModule {}
