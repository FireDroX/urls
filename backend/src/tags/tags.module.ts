import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { Tag } from './entities/tag.entity.js';
import { TypeormTagRepository } from './persistence/typeorm.tag.repository.js';
import { TagsService } from './services/tags.service.js';
import { TagsController } from './tags.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Tag]), AuditModule],
  controllers: [TagsController],
  providers: [
    { provide: 'TagsRepository', useClass: TypeormTagRepository },
    TagsService,
  ],
  exports: [TagsService],
})
export class TagsModule {}
