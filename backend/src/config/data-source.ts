import 'dotenv/config';
import { DataSource } from 'typeorm';

const sourceExtension = import.meta.filename.endsWith('.ts') ? 'ts' : 'js';

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
  entities: [`${import.meta.dirname}/../**/*.entity.${sourceExtension}`],
  migrations: [
    `${import.meta.dirname}/../database/migrations/*.${sourceExtension}`,
  ],
});
