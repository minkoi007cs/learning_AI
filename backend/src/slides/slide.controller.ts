import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { SlideService } from './slide.service';
import { UploadSlideDto } from './dto';
import { isAcceptedMime } from './slide-parser';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common';

@ApiTags('Slide Summarizer')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SlideController {
  constructor(private readonly slideService: SlideService) {}

  @Post('subjects/:subjectId/slides')
  @ApiOperation({
    summary: 'Upload a slide file to a subject and summarize it',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
      fileFilter: (_req, file, cb) => {
        if (isAcceptedMime(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only PDF, PPTX, image, or text files are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadSlide(
    @CurrentUser() user: JwtPayload,
    @Param('subjectId') subjectId: string,
    @Body() dto: UploadSlideDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.slideService.uploadAndSummarize(
      user.sub,
      subjectId,
      file,
      dto.title,
    );
  }

  @Get('slides/:id')
  @ApiOperation({ summary: 'Get a slide session with its summary' })
  getSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.slideService.get(user.sub, id);
  }

  @Delete('slides/:id')
  @ApiOperation({ summary: 'Delete a slide session' })
  removeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.slideService.remove(user.sub, id);
  }

  @Get('slides/:id/download')
  @ApiOperation({ summary: 'Download the summary as markdown or print-ready HTML' })
  @ApiQuery({ name: 'format', enum: ['md', 'html'], required: false })
  async download(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    const fmt = format === 'html' ? 'html' : 'md';
    const artifact = await this.slideService.download(user.sub, id, fmt);
    // Write directly (not via return) so the global TransformInterceptor does
    // not JSON-wrap the file body.
    res.setHeader('Content-Type', artifact.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${artifact.filename}"`,
    );
    res.send(artifact.body);
  }
}
