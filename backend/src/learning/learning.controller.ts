import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LearningService } from './learning.service';
import { ReviewFlashcardDto, SubmitQuizDto, GenerateQuizDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common';

@ApiTags('Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get('learning/dashboard')
  @ApiOperation({
    summary: 'Get learning dashboard with stats and recent activity',
  })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    return this.learningService.getDashboard(user.sub);
  }

  @Get('learning/weak-topics')
  @ApiOperation({
    summary: 'Get weak topics analysis and study recommendations',
  })
  async getWeakTopics(@CurrentUser() user: JwtPayload) {
    return this.learningService.getWeakTopics(user.sub);
  }

  @Post('flashcard/review')
  @ApiOperation({ summary: 'Review a flashcard using spaced repetition' })
  async reviewFlashcard(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewFlashcardDto,
  ) {
    return this.learningService.reviewFlashcard(user.sub, dto);
  }

  @Get('flashcard/due')
  @ApiOperation({ summary: 'Get flashcards due for review' })
  async getDueFlashcards(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.learningService.getDueFlashcards(
      user.sub,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('quiz/submit')
  @ApiOperation({ summary: 'Submit quiz answers for grading' })
  async submitQuiz(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.learningService.submitQuiz(user.sub, dto);
  }

  @Get('quiz/generate')
  @ApiOperation({ summary: 'Generate a new quiz' })
  async generateQuiz(
    @CurrentUser() user: JwtPayload,
    @Query() dto: GenerateQuizDto,
  ) {
    return this.learningService.generateQuiz(user.sub, dto);
  }
}
