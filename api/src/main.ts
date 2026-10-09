import './env';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import QRCode from 'qrcode';
import { AppModule } from './app.module';
import { ErrorFilter } from './error.filter';
import { lanAddresses } from './network';
import { WEB_DIST, webIndex } from './web';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: process.env.TRUST_PROXY === 'true', // only behind a reverse proxy (real client IP for rate limits)
      bodyLimit: 16 * 1024 * 1024, // 16 MB: base64 document uploads
    }),
  );
  await app.register(fastifyCookie);
  // Built web app files; any other non-API page falls back to index.html (see error.filter.ts).
  if (webIndex) await app.register(fastifyStatic, { root: WEB_DIST, wildcard: false });

  // The web app is same-origin (Vite proxy in dev, served by the API on the hub), and phones don't use CORS.
  // This is for other origins, e.g. Expo web. Production: only CORS_ORIGINS.
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({ origin: origins?.length ? origins : process.env.NODE_ENV !== 'production', credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErrorFilter());
  const port = Number(process.env.PORT ?? 4101);
  await app.listen(port, '0.0.0.0');
  await printUrls(port);
}
bootstrap();

// The addresses other devices on the same Wi-Fi / LAN should open, plus a QR code for phones in hub mode.
async function printUrls(port: number) {
  const path = webIndex ? '' : '/api';
  const label = webIndex ? 'App' : 'API';
  const urls = lanAddresses().map((ip) => `http://${ip}:${port}${path}`);
  console.log(`\n${label} on this computer: http://localhost:${port}${path}`);
  for (const url of urls) console.log(`${label} on the local network: ${url}`);
  if (webIndex && urls[0]) {
    console.log(`\nScan to open on a phone (same Wi-Fi):\n${await QRCode.toString(urls[0], { type: 'terminal', small: true })}`);
  }
}
