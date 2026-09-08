import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * BUG-39 (2026-09-08): bản cũ gọi `await this.$connect()` trần trong
 * `onModuleInit`. Nếu database chưa sẵn sàng ở đúng khoảnh khắc khởi động —
 * Supabase đang ngủ, mạng chớp, Vercel khởi động nguội — lỗi ném ra làm
 * **sập cả tiến trình**. Hậu quả:
 *
 *   • Trên Vercel: hàm serverless chết ngay, người dùng thấy lỗi 500 trắng
 *     trang. Endpoint `/v1/health` có sẵn try/catch để báo "database:
 *     disconnected" cũng vô dụng, vì app còn chưa kịp chạy.
 *   • Trên máy: `start.sh` báo "backend không lên" mà không nói vì sao.
 *
 * Cách đúng: kết nối là việc **nên thử**, không phải điều kiện sống còn.
 * Prisma tự kết nối lại ở truy vấn đầu tiên, nên chỉ cần ghi log cảnh báo và
 * để app chạy tiếp. `/v1/health` sẽ nói thật là database đang đứt.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Đã kết nối database');
    } catch (error) {
      // KHÔNG ném lại lỗi — xem chú thích ở đầu lớp.
      this.logger.error(
        'Chưa kết nối được database lúc khởi động — ứng dụng vẫn chạy và sẽ ' +
          'thử lại ở truy vấn đầu tiên. Kiểm tra DATABASE_URL. ' +
          `Chi tiết: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      // Đang tắt rồi thì lỗi ngắt kết nối không còn ý nghĩa gì.
    }
  }
}
