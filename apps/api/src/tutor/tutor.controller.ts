import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TutorService } from './tutor.service';
import { ChatDto, ExplainDto, SolveDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common';

@ApiTags('AI Tutor')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class TutorController {
  constructor(private readonly tutorService: TutorService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI tutor (RAG-powered)' })
  async chat(@CurrentUser() user: JwtPayload, @Body() dto: ChatDto) {
    return this.tutorService.chat(user.sub, dto);
  }

  @Post('explain')
  @ApiOperation({ summary: 'Get multi-format explanation of a topic' })
  async explain(@CurrentUser() user: JwtPayload, @Body() dto: ExplainDto) {
    return this.tutorService.explain(user.sub, dto);
  }

  @Post('solve')
  @ApiOperation({ summary: 'Solve a problem with step-by-step reasoning' })
  async solve(@CurrentUser() user: JwtPayload, @Body() dto: SolveDto) {
    return this.tutorService.solve(user.sub, dto);
  }
}
