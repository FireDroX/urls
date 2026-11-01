import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import {
  DEFAULT_TRUSTED_PROXY_HOPS,
  JSON_BODY_LIMIT,
} from './common/variables.global.js';

function trustedProxyHops(): number {
  const hops = Number(process.env.TRUST_PROXY_HOPS);
  return Number.isInteger(hops) && hops >= 0
    ? hops
    : DEFAULT_TRUSTED_PROXY_HOPS;
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('url.addrien.fr API')
    .setDescription('Redirections, partages de fichiers et dépôts.')
    .setVersion('1.0')
    .addCookieAuth('accessToken')
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.set('trust proxy', trustedProxyHops());
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.PUBLIC_URL,
    credentials: true,
    exposedHeaders: ['Retry-After', 'Content-Disposition'],
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new HttpExceptionFilter());
  if (process.env.SWAGGER === 'true') {
    setupSwagger(app);
  }
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
