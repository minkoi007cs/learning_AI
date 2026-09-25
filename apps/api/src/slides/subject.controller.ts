import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubjectService } from './subject.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common';

@ApiTags('Slide Summarizer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create a subject (môn học)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSubjectDto) {
    return this.subjectService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all subjects with session counts' })
  list(@CurrentUser() user: JwtPayload) {
    return this.subjectService.list(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subject with its slide sessions' })
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.subjectService.get(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a subject' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.subjectService.update(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a subject and its sessions' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.subjectService.remove(user.sub, id);
  }
}
