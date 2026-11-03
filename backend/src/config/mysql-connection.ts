import { Logger } from '@nestjs/common';
import mysql, {
  type Pool,
  type PoolConnection,
  type PoolOptions,
} from 'mysql2';
import {
  DB_DEFAULT_PORT,
  DB_DRIVER_TIME_ZONE,
  DB_SESSION_TIME_ZONE,
} from '../common/variables.global.js';

export interface MysqlPoolFactory {
  createPool(options: PoolOptions): Pool;
}

type EnvReader = (key: string) => string | undefined;

export const SET_SESSION_TIME_ZONE_SQL = `SET time_zone = '${DB_SESSION_TIME_ZONE}'`;

const logger = new Logger('MysqlConnection');

export function setSessionTimeZone(connection: PoolConnection): void {
  connection.query(SET_SESSION_TIME_ZONE_SQL, (error) => {
    if (error) {
      logger.error(
        `Could not set the session time zone, closing the connection: ${error.message}`,
      );
      connection.destroy();
    }
  });
}

export function withSessionTimeZone(
  driver: MysqlPoolFactory,
): MysqlPoolFactory {
  return {
    ...driver,
    createPool(options) {
      const pool = driver.createPool(options);
      pool.on('connection', setSessionTimeZone);
      return pool;
    },
  };
}

export function mysqlConnectionOptions(env: EnvReader) {
  return {
    type: 'mysql' as const,
    driver: withSessionTimeZone(mysql),
    host: env('DB_HOST'),
    port: Number(env('DB_PORT') ?? DB_DEFAULT_PORT),
    username: env('DB_USERNAME'),
    password: env('DB_PASSWORD'),
    database: env('DB_DATABASE'),
    timezone: DB_DRIVER_TIME_ZONE,
    synchronize: false,
  };
}
