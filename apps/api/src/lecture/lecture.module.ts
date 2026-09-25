import { Module } from '@nestjs/common';
import { LectureService } from './lecture.service';
import { LectureController } from './lecture.controller';

@Module({
  controllers: [LectureController],
  providers: [LectureService],
  exports: [LectureService],
})
export class LectureModule {}
