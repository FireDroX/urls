import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Pool, PoolConnection } from 'mysql2';
import { describe, expect, it, vi } from 'vitest';
import dataSource from './data-source.js';
import {
  type MysqlPoolFactory,
  mysqlConnectionOptions,
  SET_SESSION_TIME_ZONE_SQL,
  setSessionTimeZone,
  withSessionTimeZone,
} from './mysql-connection.js';
import { typeOrmConfig } from './typeorm.config.js';

type QueryCallback = (error: Error | null) => void;

function fakeConnection() {
  return { query: vi.fn(), destroy: vi.fn() };
}

function connectionListeners(driver: unknown): unknown[] {
  const pool = (driver as MysqlPoolFactory).createPool({});
  const listeners = pool.listeners('connection');
  pool.end();
  return listeners;
}

describe('mysql connection', () => {
  it('sets the session time zone to UTC', () => {
    expect(SET_SESSION_TIME_ZONE_SQL).toBe("SET time_zone = '+00:00'");
  });

  it('runs the time zone statement on a new connection', () => {
    const connection = fakeConnection();

    setSessionTimeZone(connection as unknown as PoolConnection);

    expect(connection.query).toHaveBeenCalledWith(
      SET_SESSION_TIME_ZONE_SQL,
      expect.any(Function),
    );
    const callback = connection.query.mock.calls[0][1] as QueryCallback;
    callback(null);
    expect(connection.destroy).not.toHaveBeenCalled();
  });

  it('logs and destroys a connection whose time zone could not be set', () => {
    const connection = fakeConnection();
    const logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    setSessionTimeZone(connection as unknown as PoolConnection);
    const callback = connection.query.mock.calls[0][1] as QueryCallback;
    callback(new Error('denied'));

    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('denied'));
    logError.mockRestore();
  });

  it('hooks every pooled connection created by the driver', () => {
    const pool = new EventEmitter();
    const createPool = vi.fn().mockReturnValue(pool);
    const driver = withSessionTimeZone({ createPool });
    const options = { host: 'db' };

    expect(driver.createPool(options)).toBe(pool);
    expect(createPool).toHaveBeenCalledWith(options);

    const connection = fakeConnection();
    pool.emit('connection', connection);
    pool.emit('connection', fakeConnection());
    expect(connection.query).toHaveBeenCalledWith(
      SET_SESSION_TIME_ZONE_SQL,
      expect.any(Function),
    );
    expect(pool.listenerCount('connection')).toBe(1);
  });

  it('keeps the other driver functions', () => {
    const createPoolCluster = vi.fn();
    const driver = withSessionTimeZone({
      createPool: vi.fn().mockReturnValue(new EventEmitter() as Pool),
      createPoolCluster,
    } as MysqlPoolFactory);

    expect(driver).toHaveProperty('createPoolCluster', createPoolCluster);
  });

  it('builds the connection options from the environment, in UTC', () => {
    const env: Record<string, string> = {
      DB_HOST: 'db',
      DB_PORT: '3307',
      DB_USERNAME: 'urls',
      DB_PASSWORD: 'secret',
      DB_DATABASE: 'urls',
    };

    const options = mysqlConnectionOptions((key) => env[key]);

    expect(options).toMatchObject({
      type: 'mysql',
      host: 'db',
      port: 3307,
      username: 'urls',
      password: 'secret',
      database: 'urls',
      timezone: 'Z',
      synchronize: false,
    });
    expect(connectionListeners(options.driver)).toEqual([setSessionTimeZone]);
  });

  it('defaults to the MySQL port', () => {
    expect(mysqlConnectionOptions(() => undefined).port).toBe(3306);
  });

  it('applies the UTC session to the app connection', () => {
    const config = { get: vi.fn().mockReturnValue(undefined) };

    const options = typeOrmConfig(config as unknown as ConfigService);

    expect(options).toMatchObject({ timezone: 'Z', synchronize: false });
    expect(connectionListeners(options.driver)).toEqual([setSessionTimeZone]);
  });

  it('applies the UTC session to the migrations data source', () => {
    expect(dataSource.options).toMatchObject({
      timezone: 'Z',
      synchronize: false,
    });
    expect(
      connectionListeners((dataSource.options as { driver?: unknown }).driver),
    ).toEqual([setSessionTimeZone]);
  });
});
