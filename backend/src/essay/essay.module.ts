import { Module } from '@nestjs/common';
import { EssayService } from './essay.service';
import { EssayController } from './essay.controller';

@Module({
  controllers: [EssayController],
  providers: [EssayService],
  exports: [EssayService],
})
export class EssayModule {}
