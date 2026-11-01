import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
} from './default-admin.js';

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  timezone: 'Z',
  synchronize: false,
  entities: [User],
});

async function run(): Promise<void> {
  await dataSource.initialize();
  try {
    const users = dataSource.getRepository(User);
    const settings = defaultAdminSettingsFromEnv(process.env);
    const outcome = await ensureDefaultAdmin(
      {
        countUsers: () => users.count(),
        createUser: async (admin) => {
          await users.save(users.create(admin));
        },
      },
      settings,
    );
    console.log(
      outcome === 'created'
        ? `Admin account created for ${settings.email}.`
        : 'An account already exists, nothing to do.',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
