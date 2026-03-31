import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common';
import { TransformInterceptor } from './common';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // API prefix
  const prefix = process.env.API_PREFIX || 'v1';
  app.setGlobalPrefix(prefix);

  // Global pipes (validation)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Study OS API')
    .setDescription(
      `## AI Study OS (Pro) - Production API

### Three Pillars:
- ✍️ **AI Essay Engine** - Generate high-scoring essays using rubric analysis
- 🎙️ **Lecture Intelligence** - Audio → Transcript → Insights → Study Materials  
- 🧠 **AI Tutor & Learning OS** - RAG-powered chat + SRS flashcards + Quizzes

### Authentication
All endpoints require JWT Bearer token (except /health and /auth).
`,
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Health', 'System health check')
    .addTag('Auth', 'Authentication & user management')
    .addTag('Essay', 'AI Essay Engine')
    .addTag('Lecture', 'Lecture Intelligence System')
    .addTag('AI Tutor', 'AI-powered tutoring & RAG chat')
    .addTag('Learning', 'Learning OS: flashcards, quizzes, dashboard')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'AI Study OS API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(
    `🚀 AI Study OS API running on: http://localhost:${port}/${prefix}`,
  );
  logger.log(`📚 API Docs: http://localhost:${port}/api/docs`);
  logger.log(`❤️ Health: http://localhost:${port}/${prefix}/health`);
}

bootstrap();
