import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../prisma';
import { AIService } from '../ai';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({
    summary: 'Health check — trạng thái database và nhà cung cấp AI',
    description:
      'Endpoint CÔNG KHAI. Chỉ trả về thông tin không nhạy cảm: tên model và ' +
      'loại nhà cung cấp. Tuyệt đối không trả về khoá API hay chuỗi kết nối.',
  })
  async health() {
    let dbStatus = 'unknown';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: 'ok',
      service: 'AI Study OS',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      // Cho phép giao diện hiện rõ "đang chạy Qwen hay Gemini" — xem tech.md §4.1
      ai: this.ai.getProviderInfo(),
    };
  }
}
