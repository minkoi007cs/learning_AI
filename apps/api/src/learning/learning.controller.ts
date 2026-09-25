import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { ReviewFlashcardDto, SubmitQuizDto, GenerateQuizDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload, PaginationDto } from '../common';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('learning/dashboard')
  @ApiOperation({
    summary: 'Bảng điều khiển: streak, thẻ cần ôn, hoạt động gần đây',
  })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.learningService.getDashboard(user.sub);
  }

  @Get('learning/weak-topics')
  @ApiOperation({ summary: 'Phân tích điểm yếu và gợi ý kế hoạch ôn' })
  async getWeakTopics(@CurrentUser() user: JwtPayload) {
    return this.learningService.getWeakTopics(user.sub);
  }

  // ==========================================
  // FLASHCARD
  // ==========================================

  @Post('flashcard/review')
  @ApiOperation({ summary: 'Đánh giá một thẻ theo lặp lại ngắt quãng (SM-2)' })
  async reviewFlashcard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.learningService.reviewFlashcard(user.sub, dto);
  }

  @Get('flashcard/due')
  @ApiOperation({ summary: 'Lấy các thẻ đến hạn ôn' })
  @ApiQuery({ name: 'limit', required: false })
  async getDueFlashcards(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    const safeLimit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), 200)
      : 20;
    return this.learningService.getDueFlashcards(user.sub, safeLimit);
  }

  // ==========================================
  // QUIZ
  // ==========================================

  // BUG-08: các endpoint liệt kê / mở lại quiz. Trước đây quiz tạo xong là mất
  // vĩnh viễn khi đóng cửa sổ.
  @Get('quiz')
  @ApiOperation({ summary: 'Danh sách quiz đã tạo' })
  @ApiQuery({ name: 'subjectId', required: false })
  async listQuizzes(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.learningService.listQuizzes(user.sub, {
      page: pagination.page,
      limit: pagination.limit,
      subjectId,
    });
  }

  @Post('quiz/submit')
  @ApiOperation({ summary: 'Nộp bài và chấm điểm' })
  async submitQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.learningService.submitQuiz(user.sub, dto);
  }

  // BUG-21: bản cũ là @Get('quiz/generate') — một GET nhưng lại tạo bản ghi
  // trong DB và tốn lượt gọi AI. Trình duyệt hoặc proxy có thể tự gọi trước
  // (prefetch) hoặc cache lại. Sinh dữ liệu phải là POST.
  @Post('quiz/generate')
  @ApiOperation({ summary: 'Sinh một bài quiz mới' })
  async generateQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateQuizDto,
  ) {
    return this.learningService.generateQuiz(user.sub, dto);
  }

  @Get('quiz/:id')
  @ApiOperation({ summary: 'Mở lại một bài quiz' })
  async getQuiz(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.learningService.getQuiz(user.sub, id);
  }

  @Delete('quiz/:id')
  @ApiOperation({ summary: 'Xoá một bài quiz' })
  async deleteQuiz(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.learningService.deleteQuiz(user.sub, id);
  }
}
