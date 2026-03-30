import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma';
import { LectureService } from '../lecture/lecture.service';
import { AIService } from '../ai';

export const QUEUE_NAME = 'ai-study-os';

export enum JobType {
  TRANSCRIBE_AUDIO = 'transcribe_audio',
  PROCESS_LECTURE = 'process_lecture',
  GENERATE_FLASHCARDS = 'generate_flashcards',
  GENERATE_EMBEDDING = 'generate_embedding',
  SCORE_ESSAY = 'score_essay',
}

export interface TranscribeAudioPayload {
  lectureId: string;
  userId: string;
  audioUrl: string;
}

export interface ProcessLecturePayload {
  lectureId: string;
  userId: string;
  focusTopics?: string;
}

export interface GenerateEmbeddingPayload {
  content: string;
  userId: string;
  type: string;
  sourceId?: string;
}

@Processor(QUEUE_NAME)
export class QueueProcessor extends WorkerHost {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lectureService: LectureService,
    private readonly aiService: AIService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job: ${job.name} (${job.id})`);

    // Track job in database
    await this.prisma.jobRecord.upsert({
      where: { jobId: job.id as string },
      create: {
        jobId: job.id as string,
        type: job.name,
        status: 'processing',
        payload: job.data,
        attempts: job.attemptsMade,
      },
      update: {
        status: 'processing',
        attempts: job.attemptsMade,
      },
    });

    try {
      let result: unknown;

      switch (job.name) {
        case JobType.PROCESS_LECTURE: {
          const data = job.data as ProcessLecturePayload;
          result = await this.lectureService.processLecture(
            data.userId,
            data.lectureId,
            data.focusTopics,
          );
          break;
        }

        case JobType.GENERATE_EMBEDDING: {
          const data = job.data as GenerateEmbeddingPayload;
          const embedding = await this.aiService.generateEmbedding(
            data.content,
          );
          result = await this.prisma.aIContext.create({
            data: {
              userId: data.userId,
              content: data.content,
              embedding: embedding.embedding,
              type: data.type,
              sourceId: data.sourceId,
            },
          });
          break;
        }

        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
          throw new Error(`Unknown job type: ${job.name}`);
      }

      // Update job record
      await this.prisma.jobRecord.update({
        where: { jobId: job.id as string },
        data: {
          status: 'completed',
          result: result as any,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Job completed: ${job.name} (${job.id})`);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      await this.prisma.jobRecord.update({
        where: { jobId: job.id as string },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      });

      this.logger.error(`Job failed: ${job.name} (${job.id}): ${errorMessage}`);
      throw error;
    }
  }
}
