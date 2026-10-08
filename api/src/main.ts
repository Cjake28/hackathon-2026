import './env';
import fastifyCookie from '@fastify/cookie';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { ErrorFilter } from './error.filter';

const production = process.env.NODE_ENV === 'production';

async function bootstrap() {
  // In production the API usually sits behind a proxy/load balancer: trust it for the real client IP
  // (rate limiting is per IP).
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: production, bodyLimit: 16 * 1024 * 1024 }), // 16 MB: base64 document uploads
  );
  await app.register(fastifyCookie);

  // The web app goes through the Vite proxy and phones don't use CORS, so this is for other origins
  // (Expo web, a separately hosted frontend). Dev: any origin. Production: only CORS_ORIGINS.
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : !production, credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErrorFilter());
  await app.listen(process.env.PORT ?? 4101, '0.0.0.0');
}
bootstrap();
