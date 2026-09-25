import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import {
  GlobalExceptionFilter,
  TransformInterceptor,
  buildCorsOptions,
} from './common';

function sanitizeDbUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  let url = raw.trim().replace(/^["']|["']$/g, '');
  url = url.replace(/:\[([^\]]+)\]@/, ':$1@');
  url = url.replace(/postgres\.\[([^\]]+)\]:/, 'postgres.$1:');
  url = url.replace(/\[([a-zA-Z0-9\.\-_]+)\]/g, '$1');
  return url;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = sanitizeDbUrl(process.env.DATABASE_URL);
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = sanitizeDbUrl(process.env.DIRECT_URL);
}

// Cache the express instance across warm invocations so we only
// bootstrap Nest once per serverless container (not per request).
let cachedApp: express.Express | null = null;

async function bootstrapServer(): Promise<express.Express> {
  if (cachedApp) return cachedApp;

  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { logger: ['error', 'warn', 'log'] },
  );

  app.use(helmet());

  // CORS — xem common/cors.ts (BUG-10)
  app.enableCors(buildCorsOptions());

  const prefix = process.env.API_PREFIX || 'v1';
  app.setGlobalPrefix(prefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.init();

  cachedApp = expressApp;
  return expressApp;
}

// Vercel serverless handler — forwards every request to the Nest/express app.
export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  server(req, res);
}
