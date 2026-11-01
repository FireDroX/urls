import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TimestampSubscriber } from '../common/subscribers/timestamp.subscriber.js';

export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<string>('DB_PORT') ?? 3306),
    username: config.get<string>('DB_USERNAME'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_DATABASE'),
    timezone: 'Z',
    synchronize: false,
    subscribers: [TimestampSubscriber],
    entities: [`${import.meta.dirname}/../**/*.entity.js`],
    migrations: [`${import.meta.dirname}/../database/migrations/*.js`],
  };
}
