import { Module } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { SubjectController } from './subject.controller';
import { SlideService } from './slide.service';
import { SlideController } from './slide.controller';

@Module({
  controllers: [SubjectController, SlideController],
  providers: [SubjectService, SlideService],
  exports: [SubjectService, SlideService],
})
export class SlidesModule {}
