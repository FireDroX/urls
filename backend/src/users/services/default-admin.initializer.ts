import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  defaultAdminSettingsFromEnv,
  ensureDefaultAdmin,
} from '../../database/default-admin.js';
import type { UserRepository } from '../persistence/user.repository.js';

@Injectable()
export class DefaultAdminInitializer implements OnApplicationBootstrap {
  private readonly logger = new Logger(DefaultAdminInitializer.name);

  constructor(
    @Inject('UsersRepository') private readonly usersRepository: UserRepository,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const settings = defaultAdminSettingsFromEnv({
      ADMIN_EMAIL: this.configService.get<string>('ADMIN_EMAIL'),
      ADMIN_PASSWORD: this.configService.get<string>('ADMIN_PASSWORD'),
    });
    const outcome = await ensureDefaultAdmin(
      {
        countUsers: () => this.usersRepository.count(),
        createUser: async (admin) => {
          await this.usersRepository.create(admin);
        },
      },
      settings,
    );
    if (outcome === 'created') {
      this.logger.log(`Admin account created for ${settings.email}`);
    }
  }
}
