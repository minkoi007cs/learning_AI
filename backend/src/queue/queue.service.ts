import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  QUEUE_NAME,
  JobType,
  ProcessLecturePayload,
  GenerateEmbeddingPayload,
} from './queue.processor';
import { PrismaService } from '../prisma';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAME) private readonly queue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async addProcessLectureJob(payload: ProcessLecturePayload) {
    const job = await this.queue.add(JobType.PROCESS_LECTURE, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });

    this.logger.log(`Added process lecture job: ${job.id}`);

    await this.prisma.jobRecord.create({
      data: {
        jobId: job.id as string,
        type: JobType.PROCESS_LECTURE,
        status: 'queued',
        entityId: payload.lectureId,
        entityType: 'lecture',
        payload: payload as any,
      },
    });

    return { jobId: job.id, status: 'queued' };
  }

  async addEmbeddingJob(payload: GenerateEmbeddingPayload) {
    const job = await this.queue.add(JobType.GENERATE_EMBEDDING, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { age: 3600 },
    });

    this.logger.log(`Added embedding job: ${job.id}`);
    return { jobId: job.id };
  }

  async getJobStatus(jobId: string) {
    const record = await this.prisma.jobRecord.findUnique({
      where: { jobId },
    });
    return record;
  }

  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
