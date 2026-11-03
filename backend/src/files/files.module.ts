import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoredFile } from './entities/stored-file.entity.js';
import { TypeormStoredFileRepository } from './persistence/typeorm.stored-file.repository.js';
import { FilesService } from './services/files.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StoredFile])],
  providers: [
    { provide: 'FilesRepository', useClass: TypeormStoredFileRepository },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
