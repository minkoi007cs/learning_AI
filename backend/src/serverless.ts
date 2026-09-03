import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import express from 'express';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter, TransformInterceptor } from './common';

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

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

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
