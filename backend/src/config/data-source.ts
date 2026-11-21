import 'dotenv/config';
import { DataSource } from 'typeorm';
import { mysqlConnectionOptions } from './mysql-connection.js';

const sourceExtension = import.meta.filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  ...mysqlConnectionOptions((key) => process.env[key]),
  entities: [`${import.meta.dirname}/../**/*.entity.${sourceExtension}`],
  migrations: [
    `${import.meta.dirname}/../database/migrations/*.${sourceExtension}`,
  ],
});
