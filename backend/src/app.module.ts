import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Core modules
import { PrismaModule } from './prisma';
import { AIModule } from './ai';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { EssayModule } from './essay/essay.module';
import { LectureModule } from './lecture/lecture.module';
import { LearningModule } from './learning/learning.module';
import { TutorModule } from './tutor/tutor.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';

// Guards
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // BullMQ (Redis-backed job queue)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: new URL(
            config.get<string>('REDIS_URL', 'redis://localhost:6379'),
          ).hostname,
          port: parseInt(
            new URL(config.get<string>('REDIS_URL', 'redis://localhost:6379'))
              .port || '6379',
          ),
        },
      }),
    }),

    // Core
    PrismaModule,
    AIModule,

    // Features
    AuthModule,
    EssayModule,
    LectureModule,
    LearningModule,
    TutorModule,
    QueueModule,
    HealthModule,
  ],
  providers: [
    // Global JWT guard (all routes require auth by default)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
