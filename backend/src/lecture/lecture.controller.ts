import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { LectureService } from './lecture.service';
import { UploadLectureDto, ProcessLectureDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload, PaginationDto } from '../common';

@ApiTags('Lecture')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lecture')
export class LectureController {
  constructor(private readonly lectureService: LectureService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a lecture with optional audio file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
          cb(null, true);
        } else {
          cb(new Error('Only audio files are allowed'), false);
        }
      },
    }),
  )
  async uploadLecture(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadLectureDto,
    @UploadedFile() file?: any,
  ) {
    // In production, upload to S3/R2. For now, store locally.
    const audioUrl = file ? `/uploads/${file.filename}` : undefined;
    return this.lectureService.createLecture(
      user.sub,
      dto,
      audioUrl,
      file?.originalname,
    );
  }

  @Post('process')
  @ApiOperation({
    summary: 'Process a lecture: transcribe, summarize, generate materials',
  })
  async processLecture(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ProcessLectureDto,
  ) {
    return this.lectureService.processLecture(
      user.sub,
      dto.lectureId,
      dto.focusTopics,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lecture with all materials' })
  async getLecture(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.lectureService.getLecture(user.sub, id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user lectures' })
  async getUserLectures(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    return this.lectureService.getUserLectures(
      user.sub,
      pagination.page,
      pagination.limit,
    );
  }

  @Get(':id/flashcards')
  @ApiOperation({ summary: 'Get flashcards generated from a lecture' })
  async getLectureFlashcards(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.lectureService.getLectureFlashcards(user.sub, id);
  }

  @Get(':id/quiz')
  @ApiOperation({ summary: 'Get quiz generated from a lecture' })
  async getLectureQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.lectureService.getLectureQuiz(user.sub, id);
  }
}
