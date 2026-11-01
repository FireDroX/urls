import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { TypeormUserRepository } from './persistence/typeorm.user.repository.js';
import { DefaultAdminInitializer } from './services/default-admin.initializer.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    { provide: 'UsersRepository', useClass: TypeormUserRepository },
    DefaultAdminInitializer,
  ],
  exports: ['UsersRepository'],
})
export class UsersModule {}
