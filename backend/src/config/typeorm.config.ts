import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { TimestampSubscriber } from '../common/subscribers/timestamp.subscriber.js';
import { mysqlConnectionOptions } from './mysql-connection.js';

export function typeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    ...mysqlConnectionOptions((key) => config.get<string>(key)),
    subscribers: [TimestampSubscriber],
    entities: [`${import.meta.dirname}/../**/*.entity.js`],
    migrations: [`${import.meta.dirname}/../database/migrations/*.js`],
  };
}
