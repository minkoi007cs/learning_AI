import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EssayService } from './essay.service';
import { GenerateEssayDto, ImproveEssayDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload, PaginationDto } from '../common';

@ApiTags('Essay')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('essay')
export class EssayController {
  constructor(private readonly essayService: EssayService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a high-scoring essay using AI' })
  async generateEssay(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateEssayDto,
  ) {
    return this.essayService.generateEssay(user.sub, dto);
  }

  @Post('improve')
  @ApiOperation({
    summary: 'Improve an existing essay to achieve higher scores',
  })
  async improveEssay(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ImproveEssayDto,
  ) {
    return this.essayService.improveEssay(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get essay by ID' })
  async getEssay(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.essayService.getEssay(user.sub, id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all user essays' })
  async getUserEssays(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ) {
    return this.essayService.getUserEssays(
      user.sub,
      pagination.page,
      pagination.limit,
    );
  }
}
