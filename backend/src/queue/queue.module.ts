import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueProcessor, QUEUE_NAME } from './queue.processor';
import { QueueService } from './queue.service';
import { LectureModule } from '../lecture/lecture.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QUEUE_NAME,
    }),
    LectureModule,
  ],
  providers: [QueueProcessor, QueueService],
  exports: [QueueService],
})
export class QueueModule {}
